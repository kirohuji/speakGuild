export class ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;

  static ok<T>(data: T, message = 'success'): ApiResponse<T> {
    return { code: 0, message, data };
  }

  static fail(message: string, code = 1): ApiResponse<null> {
    return { code, message, data: null };
  }
}
