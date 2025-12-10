/**
 * Mock for Next.js server exports
 */

export class NextRequest {
  method: string;
  headers: Headers;
  private _body: string | null = null;

  constructor(
    url: string | URL,
    init?: {
      method?: string;
      headers?: HeadersInit;
      body?: string;
    }
  ) {
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
    this._body = init?.body || null;
  }

  async text(): Promise<string> {
    return this._body || '';
  }

  async json(): Promise<unknown> {
    return JSON.parse(this._body || '{}');
  }
}

export class NextResponse {
  static json(
    data: unknown,
    init?: { status?: number; headers?: HeadersInit }
  ): NextResponse {
    return new NextResponse(JSON.stringify(data), init);
  }

  status: number;
  headers: Headers;
  private _body: string;

  constructor(body: string, init?: { status?: number; headers?: HeadersInit }) {
    this._body = body;
    this.status = init?.status || 200;
    this.headers = new Headers(init?.headers);
  }

  async json(): Promise<unknown> {
    return JSON.parse(this._body);
  }
}

