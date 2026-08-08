export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR", 500);
  }
}

export class DatabaseUnavailableError extends AppError {
  constructor(options?: ErrorOptions) {
    super(
      "The supply network is temporarily unreachable. Please try again shortly.",
      "DATABASE_UNAVAILABLE",
      503,
      options,
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, "NOT_FOUND", 404);
  }
}

export function toPublicError(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something unexpected happened. Please try again.",
      },
    },
  };
}
