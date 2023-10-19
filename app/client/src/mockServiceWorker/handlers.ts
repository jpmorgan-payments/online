import { rest } from 'msw';
import { API_URL } from 'data/constants';
import { type payment, paymentResponse, captureRequest, paymentPatch, refund } from '../generated-api-models/index';
import { createPaymentResponse } from 'data/createPaymentResponse';
import { paymentAuthorizeResponseListMock } from 'mocks/paymentAuthorizeResponseList.mock';
import { createCaptureResponse } from 'data/createCaptureResponse';
import { createRefundResponse } from 'data/createRefundResponse';

const previousPaymentsMock: paymentResponse[] =
  paymentAuthorizeResponseListMock;
const previousPayments = new Map();
previousPaymentsMock.map((payment) =>
  previousPayments.set(payment.transactionId, JSON.stringify(payment)),
);
export const handlers = [
  // Match create payment requests and update response to match
  rest.post(`${API_URL}/api/payments`, async (req, res, ctx) => {
    const {
      amount,
      paymentMethodType,
      merchant,
      currency,
      captureMethod,
      isAmountFinal,
      initiatorType,
    } = (await req.json()) as payment;
    const requestId = req.headers.get('request-id') as string;
    const merchantId = req.headers.get('merchant-id') as string;

    const response = createPaymentResponse({
      merchantId,
      merchant,
      requestId,
      amount,
      paymentMethodType,
      currency,
      captureMethod,
      isAmountFinal,
      initiatorType,
    });
    previousPayments.set(response.transactionId, JSON.stringify(response));
    return res(ctx.json(response));
  }),
  rest.get(`${API_URL}/api/payments/:transactionId`, async (req, res, ctx) => {
    const { transactionId } = req.params;
    const response = previousPayments.get(transactionId);
    if (response) {
      return res(ctx.json(JSON.parse(response)));
    }
    return res(
      ctx.status(404),
      ctx.json({
        responseStatus: 'ERROR',
        responseCode: 'NOT_FOUND',
        responseMessage: 'Transaction was not found',
      }),
    );
  }),
  rest.post(
    `${API_URL}/api/payments/:transactionId/captures`,
    async (req, res, ctx) => {
      const { transactionId } = req.params;
      const requestBody = (await req.json()) as captureRequest;
      const response = previousPayments.get(transactionId);
      if (response) {
        const responseObject = createCaptureResponse(
          JSON.parse(response),
          requestBody,
        );
        previousPayments.set(transactionId, JSON.stringify(responseObject));
        return res(ctx.delay(), ctx.json(responseObject));
      }
      return res(
        ctx.status(404),
        ctx.json({
          responseStatus: 'ERROR',
          responseCode: 'NOT_FOUND',
          responseMessage: 'Transaction was not found',
        }),
      );
    },
  ),
  rest.patch(
    `${API_URL}/api/payments/:transactionId`,
    async (req, res, ctx) => {
      const { transactionId } = req.params;
      const requestBody = (await req.json()) as paymentPatch;
      const response = previousPayments.get(transactionId);
      if (response && requestBody.isVoid) {
        const responseObject = JSON.parse(response);
        responseObject.isVoid = true;
        previousPayments.set(transactionId, JSON.stringify(responseObject));
        return res(ctx.json(responseObject));
      }
      return res(
        ctx.status(404),
        ctx.json({
          responseStatus: 'ERROR',
          responseCode: 'NOT_FOUND',
          responseMessage: 'Transaction was not found',
        }),
      );
    },
  ),
  rest.post(
    `${API_URL}/api/refunds`,
    async (req, res, ctx) => {
      const requestBody : refund= (await req.json()) as refund;
      const previousPayment = previousPayments.get(requestBody.paymentMethodType?.transactionReference?.transactionReferenceId);
      const response = createRefundResponse(requestBody, JSON.parse(previousPayment));
      previousPayments.set(response.transactionId, JSON.stringify(response));

      return res(ctx.json(response));
    },
  ),
];
