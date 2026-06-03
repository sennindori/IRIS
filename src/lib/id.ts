export function generateRecordNumber(existingRecordNumbers?: string[]): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  const existingSet = new Set(existingRecordNumbers || []);
  
  for (let attempt = 0; attempt < 100; attempt++) {
    result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!existingSet.has(result)) {
      break;
    }
  }
  return result;
}
