import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, replacements) {
  let text = await readFile(path, 'utf8');
  for (const [from, to] of replacements) {
    if (text.includes(to)) continue;
    if (!text.includes(from)) throw new Error(`[guest-maintenance-patch] missing target in ${path}: ${from.slice(0, 120)}`);
    text = text.replace(from, to);
  }
  await writeFile(path, text);
  console.log(`[guest-maintenance-patch] updated ${path}`);
}

await patchFile('apps/client/src/account-scene.ts', [
  [
    "import { loadGuestProgress, type GuestProgress } from './save.ts';\n",
    "import { loadGuestProgress, type GuestProgress } from './save.ts';\nimport {\n  applyGuestDeveloperResourceCode,\n  isGuestDeveloperResourceSandboxActive,\n  resetGuestLocalAccountData,\n} from './guest-maintenance.ts';\n",
  ],
  [
    "    addText(this, 64, 104, '로그인 계정은 서버 저장이 정본입니다.', compact ? 22 : 19, COLORS.muted);\n",
    "    addText(this, 64, 104, '로그인 계정은 서버 저장이 정본입니다.', compact ? 22 : 19, COLORS.muted);\n    addButton(this, 1015, 60, 185, compact ? 64 : 44, '게스트 초기화', () => { void this.resetGuestLocalAccount(); }, 0x8a6262);\n    addButton(this, 1190, 60, 150, compact ? 64 : 44, '개발자 코드', () => { void this.applyDeveloperCode(); }, 0x765f8d);\n",
  ],
  [
    "    const guestProgress = await loadGuestProgress();\n",
    "    if (isGuestDeveloperResourceSandboxActive()) {\n      this.migrationEnvelope = null;\n      this.migrationPreview = null;\n      this.replacementArmed = false;\n      this.setMessage('개발자 테스트 재화가 적용된 게스트 진행은 서버 계정으로 이전할 수 없습니다. 게스트 초기화 후 정상 진행을 사용하세요.', COLORS.red);\n      return;\n    }\n    const guestProgress = await loadGuestProgress();\n",
  ],
  [
    "  private async refresh(): Promise<void> {\n",
    "  private async resetGuestLocalAccount(): Promise<void> {\n    if (typeof window === 'undefined') return;\n    const confirmation = window.prompt('이 기기의 게스트 진행, 재화, 도감, 모집, 성장, 기록, 게스트 프로필을 모두 삭제합니다. 로그인 서버 계정은 건드리지 않습니다.\\n초기화하려면 RESET을 입력하세요.');\n    if (confirmation === null) return;\n    if (confirmation.trim() !== 'RESET') {\n      this.setMessage('게스트 초기화를 취소했습니다. RESET을 정확히 입력해야 합니다.', COLORS.gold);\n      return;\n    }\n    this.setMessage('게스트 로컬 저장을 초기화하는 중…', COLORS.muted);\n    const reset = await resetGuestLocalAccountData();\n    if (!reset) {\n      this.setMessage('게스트 저장 초기화에 실패했습니다. 브라우저 저장소 사용 가능 여부를 확인하세요.', COLORS.red);\n      return;\n    }\n    this.setMessage('게스트 로컬 저장을 초기화했습니다. 서버 계정은 변경하지 않았습니다. 새 상태를 불러옵니다.', COLORS.green);\n    window.setTimeout(() => window.location.reload(), 250);\n  }\n\n  private async applyDeveloperCode(): Promise<void> {\n    if (getAccountClientState().kind !== 'GUEST_LOCAL') {\n      this.setMessage('개발자 재화 코드는 게스트 로컬 테스트에서만 사용할 수 있습니다. 서버 계정에는 적용하지 않습니다.', COLORS.gold);\n      return;\n    }\n    if (typeof window === 'undefined') return;\n    const code = window.prompt('개발자 테스트 코드를 입력하세요.');\n    if (code === null) return;\n    this.setMessage('개발자 테스트 재화를 적용하는 중…', COLORS.muted);\n    try {\n      const result = await applyGuestDeveloperResourceCode(code);\n      if (!result.activated) {\n        this.setMessage('개발자 코드가 일치하지 않습니다.', COLORS.red);\n        return;\n      }\n      this.setMessage('개발자 테스트 재화 적용 완료 · 모든 재화를 999,999,999로 채웠습니다. 이 게스트 저장은 서버 이전이 차단됩니다.', COLORS.green);\n      window.setTimeout(() => window.location.reload(), 250);\n    } catch (error) {\n      this.setMessage(error instanceof Error ? error.message : '개발자 테스트 재화 적용에 실패했습니다.', COLORS.red);\n    }\n  }\n\n  private async refresh(): Promise<void> {\n",
  ],
]);

await patchFile('apps/client/src/social-scene.ts', [
  [
    "    addButton(this, 1040, 117, 210, compact ? 72 : 48, '친구 코드 추가', () => { void this.promptFriendRequest(); }, 0x5f7897);\n    addButton(this, 810, 117, 210, compact ? 72 : 48, '닉네임 변경', () => { void this.promptRename(); }, 0x6b628f);\n",
    "    addButton(this, 1040, 117, 210, compact ? 72 : 48, '친구 코드 추가', () => { if (!this.requireOnlineSocial()) return; void this.promptFriendRequest(); }, 0x5f7897);\n    addButton(this, 810, 117, 210, compact ? 72 : 48, '닉네임 변경', () => { if (!this.requireOnlineSocial()) return; void this.promptRename(); }, 0x6b628f);\n",
  ],
  [
    "    if (!this.summary) {\n      const message = getAccountClientState().kind === 'AUTHENTICATED_ONLINE' ? '동기화 중…' : '계정 메뉴에서 로그인하세요.';\n      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 365, message, compact ? 28 : 24, '#aeb8c5', 'center').setOrigin(0.5));\n      return;\n    }\n",
    "    if (!this.summary) {\n      const online = getAccountClientState().kind === 'AUTHENTICATED_ONLINE';\n      const message = online ? '동기화 중…' : `${TAB_LABELS[this.tab]} 기능은 온라인 로그인 후 사용할 수 있습니다.`;\n      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 350, message, compact ? 28 : 24, '#aeb8c5', 'center').setOrigin(0.5));\n      if (!online) {\n        this.contentLayer.add(addButton(this, INTERNAL_WIDTH / 2, 425, 260, compact ? 76 : 54, '계정에서 로그인', () => this.scene.start('account'), 0x5f7897));\n      }\n      return;\n    }\n",
  ],
  [
    "  private async refresh(message?: string): Promise<void> {\n",
    "  private requireOnlineSocial(): boolean {\n    if (getAccountClientState().kind === 'AUTHENTICATED_ONLINE') return true;\n    this.statusText?.setText('친구 기능은 온라인 로그인이 필요합니다. 계정 화면으로 이동합니다.').setColor('#ffd493');\n    this.scene.start('account');\n    return false;\n  }\n\n  private async refresh(message?: string): Promise<void> {\n",
  ],
]);
