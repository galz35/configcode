import { Request, Response, NextFunction } from "express";
import pino from "pino";

const logger = pino();

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof AppError) {
    logger.warn({ path: req.path, status: err.statusCode, msg: err.message }, "App Warning");
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  // Generic Unhandled Server Error
  logger.error({ path: req.path, err }, "Unhandled System Error");
  
  res.status(500).json({
    error: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message
  });
}
