declare global {
  const utf8: {
   encode(input: string): string;
   decode(input: string): string;
  }
}

export {};