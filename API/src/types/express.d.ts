import type { AuthContext } from "../middleware/auth";

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware when a valid access token is present. */
      auth?: AuthContext;
      /** Raw request body (Buffer) – only captured for webhook routes needing signature checks. */
      rawBody?: Buffer;
    }
  }
}

export {};
