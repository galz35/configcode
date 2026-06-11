import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./errors";

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

// Sample Route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Error handling middleware
app.use(errorHandler);

export default app;
