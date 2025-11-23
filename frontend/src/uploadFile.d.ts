declare module '../uploadFile' {
  export function uploadFile(file: File): Promise<string>;
}
