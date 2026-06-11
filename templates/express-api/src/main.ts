import dotenv from "dotenv";
import app from "./app";
import pino from "pino";

dotenv.config();

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true }
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info(`⚡️ Server is running on port ${port}`);
});
