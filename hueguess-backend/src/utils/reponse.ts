import { Response } from 'express';

type ApiResponse<T = unknown> = {
  status: 'success' | 'error';
  data?: T;
  message?: string;
};

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200) => {
  const response: ApiResponse<T> = {
    status: 'success',
    data,
  };
  return res.status(statusCode).json(response);
};

export const sendError = (res: Response, message: string, statusCode = 400) => {
  const response: ApiResponse = {
    status: 'error',
    message,
  };
  return res.status(statusCode).json(response);
};