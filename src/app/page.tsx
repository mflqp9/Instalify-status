import { Suspense } from "react";

import { BoardSkeleton } from "@/components/BoardSkeleton";
import { StatusBoard } from "@/components/StatusBoard";
import { getStatusBoard } from "@/lib/status/board";

export default function Page() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board />
    </Suspense>
  );
}

async function Board() {
  const board = await getStatusBoard();
  return <StatusBoard initial={board} />;
}
