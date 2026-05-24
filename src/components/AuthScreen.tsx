import type { CSSProperties } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { LogoMark, MonoLabel } from "./Primitives";

/* AuthScreen — editorial landing + Google sign-in. */
export const AuthScreen = ({ error }: { error?: string }) => {
  return (
    <div style={S.root}>
      {/* hairline brand bar */}
      <div style={S.brandbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={28} font={10} />
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 14,
              color: "var(--text-display)",
              letterSpacing: -0.2,
            }}
          >
            치트키 Todo
          </span>
        </div>
        <MonoLabel tracking={1.5}>v0.1 — beta</MonoLabel>
      </div>

      {/* two-pane editorial layout */}
      <div style={S.pane}>
        {/* LEFT — editorial copy */}
        <div style={S.left}>
          <div style={S.eyebrowRow}>
            <span style={S.dot} />
            <MonoLabel color="var(--accent)" tracking={1.8}>Daily · Editorial</MonoLabel>
          </div>

          <h1 style={S.h1}>
            오늘 할 일,<br />
            <em style={S.h1em}>한 줄</em>로 충분합니다.
          </h1>

          <p style={S.lede}>
            과한 기능과 알림은 덜고,<br />
            마감과 우선순위만 또렷하게 남긴 할 일 노트.
          </p>

          <ul style={S.featList}>
            {(
              [
                ["01", "타임라인 + 캘린더", "오늘과 이번 주를 한 화면에서."],
                ["02", "프로젝트와 하위 할일", "복잡한 일은 잘게 쪼개서."],
                ["03", "마감일 우선 정렬", "늦지 않을 만큼만 본다."],
              ] as const
            ).map(([n, t, d]) => (
              <li key={n} style={S.featItem}>
                <span style={S.featNum}>{n}</span>
                <div>
                  <div style={S.featTitle}>{t}</div>
                  <div style={S.featDesc}>{d}</div>
                </div>
              </li>
            ))}
          </ul>

          <div style={S.footnote}>
            <MonoLabel size={10} tracking={1}>
              Powered by Supabase · 데이터는 본인 계정에만 저장됩니다
            </MonoLabel>
          </div>
        </div>

        {/* RIGHT — login card */}
        <div style={S.right}>
          <div style={S.loginCard}>
            {error && (
              <div style={S.errorBar}>
                <MonoLabel color="var(--accent)" tracking={1.2}>
                  로그인 실패 — 다시 시도해주세요
                </MonoLabel>
              </div>
            )}
            <div style={S.cardEyebrow}>
              <MonoLabel color="var(--accent)" tracking={1.5}>SIGN IN</MonoLabel>
            </div>
            <h2 style={S.cardTitle}>시작하기</h2>
            <p style={S.cardLede}>
              구글 계정으로 1초 만에 시작해보세요.<br />
              비밀번호도, 가입 양식도 없습니다.
            </p>

            <form action={signInWithGoogle}>
              <GoogleSignInButton style={S.googleBtn} />
            </form>

            <div style={S.divider}>
              <span style={S.dividerLine} />
              <MonoLabel size={10} tracking={1.5}>OR</MonoLabel>
              <span style={S.dividerLine} />
            </div>

            <button style={S.ghostBtn} disabled type="button">
              <span>이메일 매직 링크</span>
              <span style={S.comingPill}>Coming soon</span>
            </button>

            <p style={S.fine}>
              계속을 누르면 <a href="#" style={S.fineLink}>이용약관</a>과{" "}
              <a href="#" style={S.fineLink}>개인정보 처리방침</a>에 동의합니다.
            </p>
          </div>

          <div style={S.signature}>
            <span style={S.sigRule} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontSize: 14,
                color: "var(--text-muted)",
                fontVariationSettings: '"opsz" 14, "wght" 400',
              }}
            >
              made for people who write things down.
            </span>
            <span style={S.sigRule} />
          </div>
        </div>
      </div>
    </div>
  );
};

const S: Record<string, CSSProperties> = {
  root: {
    width: "100%",
    minHeight: "100vh",
    background: "var(--bg-page)",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-body)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  brandbar: {
    height: 56,
    padding: "0 40px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  pane: { flex: 1, display: "grid", gridTemplateColumns: "1.15fr 1fr", minHeight: 0 },
  left: {
    padding: "72px 64px 56px",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 28,
    position: "relative",
  },
  eyebrowRow: { display: "flex", alignItems: "center", gap: 10 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "var(--accent)",
    boxShadow: "0 0 10px var(--accent)",
  },
  h1: {
    fontFamily: "var(--font-body)",
    fontSize: 64,
    fontWeight: 300,
    letterSpacing: -2.5,
    lineHeight: 1.05,
    color: "var(--text-display)",
    margin: 0,
  },
  h1em: {
    fontStyle: "italic",
    fontFamily: "var(--font-display)",
    fontVariationSettings: '"opsz" 144, "wght" 360',
    color: "var(--accent-bright)",
    fontWeight: 400,
    letterSpacing: -3,
  },
  lede: {
    fontSize: 18,
    lineHeight: 1.65,
    color: "var(--text-secondary)",
    maxWidth: 460,
    margin: 0,
  },
  featList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginTop: 8,
    borderTop: "1px solid var(--border)",
  },
  featItem: {
    display: "grid",
    gridTemplateColumns: "64px 1fr",
    gap: 24,
    alignItems: "baseline",
    padding: "20px 0",
    borderBottom: "1px solid var(--border)",
  },
  featNum: {
    fontFamily: "var(--font-display)",
    fontStyle: "italic",
    fontVariationSettings: '"opsz" 72, "wght" 360',
    fontSize: 32,
    color: "var(--accent)",
    letterSpacing: -1,
  },
  featTitle: {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: 16,
    color: "var(--text-display)",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  featDesc: { fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 },
  footnote: { marginTop: "auto", paddingTop: 24 },
  right: {
    padding: "72px 64px 56px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    background:
      "radial-gradient(ellipse at 50% 30%, rgba(217,119,87,0.08) 0%, transparent 60%)",
  },
  loginCard: {
    width: "100%",
    maxWidth: 380,
    padding: 36,
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--border-strong)",
    background: "var(--bg-surface)",
    boxShadow: "var(--shadow-md)",
  },
  errorBar: {
    marginBottom: 16,
    padding: "10px 12px",
    borderRadius: "var(--radius-sm)",
    background: "var(--accent-dim)",
    border: "1px solid var(--border-accent)",
  },
  cardEyebrow: { marginBottom: 14 },
  cardTitle: {
    fontFamily: "var(--font-display)",
    fontVariationSettings: '"opsz" 72, "wght" 380',
    fontSize: 36,
    fontWeight: 400,
    letterSpacing: -0.8,
    lineHeight: 1,
    color: "var(--text-display)",
    margin: "0 0 12px",
  },
  cardLede: {
    fontSize: 14.5,
    lineHeight: 1.65,
    color: "var(--text-muted)",
    margin: "0 0 28px",
  },
  googleBtn: {
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "14px 20px",
    borderRadius: "var(--radius)",
    background: "#faf9f5",
    color: "#1f1e1d",
    border: "1px solid #faf9f5",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: -0.2,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    transition: "transform .15s, box-shadow .15s",
  },
  divider: { display: "flex", alignItems: "center", gap: 14, margin: "24px 0" },
  dividerLine: { flex: 1, height: 1, background: "var(--border)" },
  ghostBtn: {
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 18px",
    borderRadius: "var(--radius)",
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
    fontFamily: "var(--font-body)",
    fontSize: 14,
    cursor: "not-allowed",
  },
  comingPill: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    padding: "2px 7px",
    borderRadius: 4,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--border)",
    color: "var(--text-faint)",
    letterSpacing: 0.5,
  },
  fine: {
    fontSize: 12,
    color: "var(--text-faint)",
    lineHeight: 1.6,
    marginTop: 22,
    marginBottom: 0,
    textAlign: "center",
  },
  fineLink: {
    color: "var(--text-muted)",
    textDecoration: "underline",
    textDecorationColor: "var(--border)",
    textUnderlineOffset: 3,
  },
  signature: { display: "flex", alignItems: "center", gap: 14, width: "100%", maxWidth: 380 },
  sigRule: { flex: 1, height: 1, background: "var(--border)" },
};
