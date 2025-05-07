export interface FetchErrorJson {
  statusCode: number;
  error: string;
  message: string;
}

export class FetchError extends Error {
  statusCode: number;
  error: string;
  message: string;
  constructor(errorJson: FetchErrorJson) {
    super(errorJson.message);
    this.statusCode = errorJson.statusCode;
    this.message = errorJson.message;
    this.error = errorJson.error;
  }
}

export const isFetchError = (err: unknown): err is FetchError => {
  return err instanceof FetchError;
};
