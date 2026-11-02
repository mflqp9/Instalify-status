import { getStatusBoard } from "@/lib/status/board";

// What the page polls every minute. It shares the board's one-minute cache, so
// however many browsers poll, the providers are asked at most once a minute.
export async function GET() {
  const board = await getStatusBoard();
  return Response.json(board);
}
