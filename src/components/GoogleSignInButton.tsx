"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";
import { GoogleIcon } from "./Primitives";

// AuthScreen 은 RSC 이므로 pending 상태를 다루기 위해 버튼만 client 로 분리.
// 더블 클릭으로 PKCE verifier 가 덮어쓰여 invalid_grant 가 나는 race 방지.
export function GoogleSignInButton({ style }: { style: CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        ...style,
        opacity: pending ? 0.6 : 1,
        cursor: pending ? "wait" : "pointer",
      }}
    >
      <GoogleIcon size={18} />
      <span>{pending ? "이동 중…" : "Google 계정으로 계속하기"}</span>
    </button>
  );
}
