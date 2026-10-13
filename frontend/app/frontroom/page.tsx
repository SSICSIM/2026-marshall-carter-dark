import { Suspense } from "react";

import { FrontroomPage } from "@/components/mechanics/FrontroomPage";

export default function Page() {
  // FrontroomPage reads ?delegate= via useSearchParams, which needs a
  // Suspense boundary under the App Router.
  return (
    <Suspense>
      <FrontroomPage />
    </Suspense>
  );
}
