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
    this.name = 'FetchError';
    this.statusCode = errorJson.statusCode;
    this.message = errorJson.message;
    this.error = errorJson.error;
  }

  static async fromResponse(response: Response): Promise<FetchError> {
    return new FetchError({
      statusCode: response.status,
      error: response.statusText,
      message: '',
    });
  }
}

export const isFetchError = (err: unknown): err is FetchError => {
  return err instanceof FetchError;
};
