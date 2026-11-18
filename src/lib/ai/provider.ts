export interface AiRequest {
  system: string;
  prompt: string;
  /** base64 JPEG */
  image?: string;
  schema: Record<string, unknown>;
  effort: 'low' | 'medium' | 'high';
}

export interface Provider {
  /** Returns the model's raw JSON text. */
  json(req: AiRequest): Promise<string>;
}
