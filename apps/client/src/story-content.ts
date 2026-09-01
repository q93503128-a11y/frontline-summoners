export type StoryPresentationKind = 'CHAPTER_INTRO' | 'BOSS_PRELUDE' | 'CHAPTER_OUTRO';

export interface StoryBeat {
  readonly speaker: string;
  readonly text: string;
}

export interface StoryPresentation {
  readonly id: string;
  readonly chapter: number;
  readonly kind: StoryPresentationKind;
  readonly title: string;
  readonly subtitle: string;
  readonly accent: number;
  readonly beats: readonly StoryBeat[];
  readonly beforeStageId?: string;
  readonly afterStageId?: string;
}

/**
 * First-completion story presentation is deliberately short and optional.
 * These beats are atmosphere only; gameplay rules, unlock conditions and boss telegraphs stay in system UI.
 */
export const MAIN_STORY_PRESENTATIONS: readonly StoryPresentation[] = Object.freeze([
  {
    id: 'story_ch1_intro', chapter: 1, kind: 'CHAPTER_INTRO', title: '제1장 · 뒤집힌 국경', subtitle: '풀바람 초소로 향하는 길', accent: 0x7b8d6a,
    beforeStageId: 'main_01_001',
    beats: [
      { speaker: '전선 기록', text: '국경의 표지들이 하나같이 안쪽을 향한 채 뒤집혀 있었다.' },
      { speaker: '전선 기록', text: '버려진 초소 너머로 약탈대의 깃발이 보인다. 아직 거대한 전쟁은 아니다.' },
      { speaker: '지휘', text: '보급을 모으고 전선을 세운다. 첫 전투는 여기서 시작한다.' },
    ],
  },
  {
    id: 'story_ch1_final', chapter: 1, kind: 'BOSS_PRELUDE', title: '철문과 황금가면', subtitle: '제1장 최종전', accent: 0xb99752,
    beforeStageId: 'main_01_020',
    beats: [
      { speaker: '전선 기록', text: '철문이 닫히고, 그 위로 황금빛 가면이 모습을 드러낸다.' },
      { speaker: '경계병', text: '철문장군이 전열을 막고 있습니다. 뒤쪽에는 황금가면 사령술사까지 확인.' },
      { speaker: '지휘', text: '한쪽만 무너뜨려서는 끝나지 않는다. 전선을 끝까지 밀어붙인다.' },
    ],
  },
  {
    id: 'story_ch1_outro', chapter: 1, kind: 'CHAPTER_OUTRO', title: '국경 너머', subtitle: '제1장 완료', accent: 0x91a977,
    afterStageId: 'main_01_020',
    beats: [
      { speaker: '전선 기록', text: '철문이 열리자 뒤집혀 있던 국경의 길도 다시 바깥을 향했다.' },
      { speaker: '전선 기록', text: '그러나 길은 하나로 끝나지 않았다. 메인 전선 바깥에서 새로운 신호들이 들어오기 시작한다.' },
      { speaker: '지휘', text: '국경은 넘었다. 이제 전선은 더 넓어진다.' },
    ],
  },
  {
    id: 'story_ch2_intro', chapter: 2, kind: 'CHAPTER_INTRO', title: '제2장 · 뒤틀린 숲', subtitle: '휘어진 나무길', accent: 0x648a68,
    beforeStageId: 'main_02_001',
    beats: [
      { speaker: '전선 기록', text: '국경을 벗어나자 길보다 먼저 나무들이 방향을 잃었다.' },
      { speaker: '정찰', text: '짐승 흔적 사이로 움직이는 덩굴이 있습니다. 더 안쪽에는 묘지의 흔적도 확인됩니다.' },
      { speaker: '지휘', text: '같은 전선이라도 상대는 달라졌다. 속성을 보고 대응한다.' },
    ],
  },
  {
    id: 'story_ch2_final', chapter: 2, kind: 'BOSS_PRELUDE', title: '뿌리와 백골의 왕좌', subtitle: '제2장 최종전', accent: 0x7e8060,
    beforeStageId: 'main_02_020',
    beats: [
      { speaker: '전선 기록', text: '거대한 뿌리가 오래된 묘지 전체를 감싸 하나의 왕좌처럼 솟아 있다.' },
      { speaker: '정찰', text: '뿌리과부와 종 없는 장의왕, 두 세력이 같은 길목에 집결했습니다.' },
      { speaker: '지휘', text: '살아 있는 숲과 되살아난 군세를 함께 넘어간다.' },
    ],
  },
  {
    id: 'story_ch2_outro', chapter: 2, kind: 'CHAPTER_OUTRO', title: '숲이 비킨 자리', subtitle: '제2장 완료', accent: 0x78a36f,
    afterStageId: 'main_02_020',
    beats: [
      { speaker: '전선 기록', text: '왕좌가 무너지자 뒤틀린 숲 사이로 오래 막혀 있던 길이 드러났다.' },
      { speaker: '정찰', text: '길 끝에서 거대한 첨탑들이 보입니다. 도시 전체에 마력 반응이 있습니다.' },
      { speaker: '지휘', text: '다음 전장은 숲이 아니다. 세라페로 향한다.' },
    ],
  },
  {
    id: 'story_ch3_intro', chapter: 3, kind: 'CHAPTER_INTRO', title: '제3장 · 마도도시 세라페', subtitle: '유리문의 거리', accent: 0x746aa2,
    beforeStageId: 'main_03_001',
    beats: [
      { speaker: '전선 기록', text: '세라페의 문은 유리처럼 빛났지만, 거리에는 이미 전투 흔적이 길게 남아 있었다.' },
      { speaker: '정찰', text: '부유 구조물과 초장거리 마도포대 확인. 골목 안쪽에는 악마 계열 반응도 있습니다.' },
      { speaker: '지휘', text: '사거리가 길다고 안전한 것은 아니다. 빈틈을 찾아 전선을 붙인다.' },
    ],
  },
  {
    id: 'story_ch3_final', chapter: 3, kind: 'BOSS_PRELUDE', title: '세라페 붕괴전', subtitle: '제3장 최종전', accent: 0x8a65a6,
    beforeStageId: 'main_03_020',
    beats: [
      { speaker: '전선 기록', text: '두 첨탑 사이의 봉인이 갈라지며 도시의 마력 흐름이 한곳으로 몰린다.' },
      { speaker: '정찰', text: '제7첨탑의 대마도장과 계약대공 벨자르, 양쪽 모두 전선에 진입합니다.' },
      { speaker: '지휘', text: '멀리 있는 적과 파고드는 적을 동시에 상대한다. 세라페를 돌파한다.' },
    ],
  },
  {
    id: 'story_ch3_outro', chapter: 3, kind: 'CHAPTER_OUTRO', title: '무너진 첨탑 너머', subtitle: '제3장 완료', accent: 0x7f72aa,
    afterStageId: 'main_03_020',
    beats: [
      { speaker: '전선 기록', text: '세라페의 첨탑이 멈춘 뒤에도 멀리서 규칙적인 금속음이 계속 들려왔다.' },
      { speaker: '정찰', text: '북동쪽에 대규모 기계 전선. 그리고 지도에 없는 공간 균열이 함께 관측됩니다.' },
      { speaker: '지휘', text: '기계와 균열이 같은 곳에 있다. 마지막 기본 전선으로 간다.' },
    ],
  },
  {
    id: 'story_ch4_intro', chapter: 4, kind: 'CHAPTER_INTRO', title: '제4장 · 기어 제국의 균열', subtitle: '톱니날 평원', accent: 0x8c755e,
    beforeStageId: 'main_04_001',
    beats: [
      { speaker: '전선 기록', text: '평원 위를 톱니와 레일이 가로지르고, 그 사이의 공간은 접힌 종이처럼 어긋나 있다.' },
      { speaker: '정찰', text: 'MACHINE 군세와 정체 불명의 ANOMALY가 동시에 움직입니다.' },
      { speaker: '지휘', text: '지금까지 배운 전선의 문법을 전부 쓴다. 제국의 중심부로 진입한다.' },
    ],
  },
  {
    id: 'story_ch4_final', chapter: 4, kind: 'BOSS_PRELUDE', title: '전선의 끝, 균열의 시작', subtitle: '제4장 최종전', accent: 0x8a6d68,
    beforeStageId: 'main_04_020',
    beats: [
      { speaker: '전선 기록', text: '제로의 심장부에서 모든 기계음이 한순간 멎었다.' },
      { speaker: '정찰', text: '공허엔진 제로 확인. MACHINE과 ANOMALY 반응이 완전히 겹쳐 있습니다.' },
      { speaker: '지휘', text: '여기가 첫 전선의 끝이다. 끝까지 밀어 균열을 연다.' },
    ],
  },
  {
    id: 'story_ch4_outro', chapter: 4, kind: 'CHAPTER_OUTRO', title: '첫 전선의 끝', subtitle: '제4장 완료 · 1차 엔딩', accent: 0xa9846f,
    afterStageId: 'main_04_020',
    beats: [
      { speaker: '전선 기록', text: '공허엔진이 멈추자 기어 제국의 전선도 함께 정지했다.' },
      { speaker: '전선 기록', text: '하지만 닫혀야 할 균열은 사라지지 않았다. 오히려 그 너머에서 새로운 신호가 돌아온다.' },
      { speaker: '지휘', text: '기본 전선은 완주했다. 다음 전선은 아직 지도에 없다.' },
    ],
  },
]);

const BY_ID = new Map(MAIN_STORY_PRESENTATIONS.map((story) => [story.id, story] as const));
const BEFORE_STAGE = new Map(MAIN_STORY_PRESENTATIONS.flatMap((story) => story.beforeStageId ? [[story.beforeStageId, story] as const] : []));
const AFTER_STAGE = new Map(MAIN_STORY_PRESENTATIONS.flatMap((story) => story.afterStageId ? [[story.afterStageId, story] as const] : []));

export function getStoryPresentation(storyId: string): StoryPresentation {
  const story = BY_ID.get(storyId);
  if (!story) throw new Error(`unknown story presentation: ${storyId}`);
  return story;
}

export function getPreStageStory(stageId: string): StoryPresentation | undefined {
  return BEFORE_STAGE.get(stageId);
}

export function getPostStageStory(stageId: string): StoryPresentation | undefined {
  return AFTER_STAGE.get(stageId);
}
