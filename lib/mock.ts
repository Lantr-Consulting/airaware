// Milestone 1 mock data — one coherent week for a fixture user in Austin,
// TX, shaped exactly like the records the backend will return. Numbers are
// hand-checked against the band scales in lib/bands.ts so every screen
// renders honestly. "Today" is pinned so the UI is deterministic.

import { pollenReading } from "./bands";
import type {
  Activity,
  Advisor,
  Briefing,
  DailySummary,
  DayPlan,
  HourlyConditions,
  Location,
  Message,
  PlanRun,
  Thread,
} from "./types";

export const TODAY = "2026-07-31"; // a Friday
export const NOW_HHMM = "12:00"; // "now" is pinned like the date

export const HOME: Location = {
  name: "美国 · 奥斯汀",
  lat: 30.27,
  lon: -97.74,
  tz: "America/Chicago",
  zip: "78701",
};

// ---------- Advisor ----------

export const ADVISOR: Advisor = {
  activated: true,
  paused: false,
  profile: {
    asthma: false,
    pollenAllergies: ["禾本科", "豚草"],
    skinType: 2,
    heatTolerance: "typical",
    kidMode: false,
    notes:
      "正在为 10 月的 10 公里跑步训练。偏好早晨，但不希望早于 6:30；每天晚上要遛狗。",
  },
  thresholds: {
    uvProtect: 3, // skin type II — protection starts at Moderate
    uvAvoid: 8,
    aqiCaution: 100, // grass/ragweed allergies — flag hard efforts early
    aqiAvoid: 150,
    heatCautionF: 95,
    heatAvoidF: 103,
    pollenCaution: 2,
  },
  homeLocation: HOME,
  units: "metric",
};

// ---------- Activities ----------

export const ACTIVITIES: Activity[] = [
  {
    id: "a1",
    name: "晨跑",
    kind: "run",
    daysOfWeek: [1, 3, 5],
    startTime: "07:00",
    durationMin: 45,
    intensity: "high",
    flexibility: "flex_time",
    indoorAlternative: "健身房跑步机",
    enabled: true,
  },
  {
    id: "a2",
    name: "骑车通勤",
    kind: "commute",
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "08:30",
    durationMin: 25,
    intensity: "moderate",
    flexibility: "fixed",
    enabled: true,
  },
  {
    id: "a3",
    name: "足球训练",
    kind: "sport",
    daysOfWeek: [2, 4],
    startTime: "17:30",
    durationMin: 90,
    intensity: "high",
    flexibility: "fixed",
    indoorAlternative: "室内五人制球场",
    enabled: true,
  },
  {
    id: "a4",
    name: "山野徒步",
    kind: "hike",
    daysOfWeek: [6],
    startTime: "09:00",
    durationMin: 180,
    intensity: "moderate",
    flexibility: "flex_day",
    enabled: true,
  },
  {
    id: "a5",
    name: "晚间遛狗",
    kind: "chores",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startTime: "20:00",
    durationMin: 30,
    intensity: "low",
    flexibility: "flex_time",
    enabled: true,
  },
  {
    id: "a6",
    name: "社区花园志愿服务",
    kind: "volunteer",
    daysOfWeek: [0],
    startTime: "10:00",
    durationMin: 120,
    intensity: "moderate",
    flexibility: "flex_time",
    enabled: true,
  },
];

// ---------- Today's hourly conditions (Austin in late July) ----------

const h = (
  time: string,
  tempF: number,
  apparentF: number,
  humidity: number,
  uvIndex: number,
  cloudCover: number,
  precipProb: number,
  windMph: number,
  usAqi: number,
  pollenIdx: number | null
): HourlyConditions => ({
  time: `${TODAY}T${time}:00`,
  tempF,
  apparentF,
  humidity,
  uvIndex,
  cloudCover,
  precipProb,
  windMph,
  usAqi,
  pollen: pollenIdx === null ? null : pollenReading(pollenIdx, ["禾本科", "豚草"]),
});

export const TODAY_HOURLY: HourlyConditions[] = [
  h("06:00", 78, 80, 74, 0, 18, 0, 6, 52, 4.1),
  h("07:00", 79, 82, 71, 1, 15, 0, 6, 54, 4.3),
  h("08:00", 82, 85, 66, 3, 12, 0, 7, 58, 4.6),
  h("09:00", 86, 90, 58, 5, 10, 0, 8, 63, 4.8),
  h("10:00", 90, 95, 51, 7, 8, 0, 9, 68, 4.9),
  h("11:00", 94, 99, 45, 9, 6, 0, 9, 74, 4.7),
  h("12:00", 97, 103, 40, 10, 5, 0, 10, 80, 4.4),
  h("13:00", 99, 105, 37, 10, 5, 0, 10, 86, 4.2),
  h("14:00", 100, 106, 35, 9, 6, 0, 11, 91, 4.0),
  h("15:00", 101, 106, 34, 8, 8, 0, 11, 95, 3.9),
  h("16:00", 100, 105, 35, 6, 10, 0, 11, 97, 3.8),
  h("17:00", 99, 104, 37, 4, 12, 0, 10, 96, 3.8),
  h("18:00", 97, 102, 40, 2, 14, 0, 9, 92, 3.9),
  h("19:00", 94, 99, 45, 1, 15, 0, 8, 85, 4.0),
  h("20:00", 91, 96, 50, 0, 16, 0, 7, 76, 4.1),
  h("21:00", 88, 92, 55, 0, 18, 0, 7, 68, 4.2),
];

// ---------- The week ahead (Planner) ----------

const d = (
  date: string,
  uvMax: number,
  apparentMaxF: number,
  aqiMax: number,
  pollenIdx: number | null,
  tempMaxF: number,
  tempMinF: number,
  precipProb: number
): DailySummary => ({
  date,
  uvMax,
  apparentMaxF,
  aqiMax,
  pollen: pollenIdx === null ? null : pollenReading(pollenIdx, ["grass", "ragweed"]),
  tempMaxF,
  tempMinF,
  precipProb,
});

export const WEEK: DailySummary[] = [
  d("2026-07-31", 10, 106, 97, 4.9, 101, 78, 0),
  d("2026-08-01", 11, 108, 102, 5.2, 103, 79, 0),
  d("2026-08-02", 10, 104, 88, 5.0, 100, 78, 5),
  d("2026-08-03", 9, 99, 72, 4.4, 96, 76, 20),
  d("2026-08-04", 7, 93, 55, 3.1, 91, 74, 55),
  d("2026-08-05", 8, 95, 48, 2.2, 93, 73, 15),
  d("2026-08-06", 9, 98, 61, 2.8, 95, 74, 5),
];

// ---------- Day plans ----------

export const PLANS: DayPlan[] = [
  {
    id: "p1",
    date: TODAY,
    location: HOME,
    status: "active",
    dayScore: 58,
    summary:
      "7 月末的典型炎热天气：早晨适合外出；14:00—17:00 体感最高约 41°C，达到危险等级，午后空气质量也会逐渐下降。今天的户外活动尽量安排在早上。",
    supersededNote: "06:02 已重新规划：最新预报显示，今晚的高温消退得比昨天预计更慢。",
    items: [
      {
        id: "i1",
        activityId: "a1",
        kind: "keep",
        title: "07:00 晨跑 · 条件合适",
        rationale:
          "紫外线指数 1（低），体感约 28°C，AQI 54（良，低于你的 100 警戒值）。这是今天最适合跑步的时段。",
        window: { start: "07:00", end: "07:45" },
        checks: [
          { rule: "uv_band", detail: "紫外线指数 1（低），无需额外防晒措施", value: 1, band: "低", thresholdSource: "WHO 紫外线分级", pass: true },
          { rule: "heat_index", detail: "体感约 28°C，低于你设定的 35°C 提醒线", value: 82, band: "舒适", thresholdSource: "个人高温提醒", pass: true },
          { rule: "aqi_intensity", detail: "高强度活动时 AQI 54，低于你设定的 100 提醒线", value: 54, band: "良", thresholdSource: "个人空气质量提醒", pass: true },
        ],
        severity: "info",
        status: "auto",
        evidence: ["Open-Meteo 逐小时预报（演示数据）", "个人阈值 · 版本 3"],
      },
      {
        id: "i2",
        activityId: "a2",
        kind: "gear",
        title: "下班骑行请准备防晒霜和长袖",
        rationale:
          "08:30 出发时紫外线指数为 3，刚好达到你的防护线（皮肤类型 II）。17:30 回程时紫外线指数约 4，并会连续暴露约 25 分钟，更需要注意。",
        window: { start: "17:30", end: "17:55" },
        checks: [
          { rule: "uv_band", detail: "两段骑行的紫外线指数为 3—4，达到或超过你的防护线", value: 4, band: "中等", thresholdSource: "皮肤类型 II", pass: false },
        ],
        severity: "caution",
        status: "auto",
        evidence: ["逐小时紫外线预报（演示数据）"],
      },
      {
        id: "i3",
        kind: "warning",
        title: "14:00—17:00 高温达到危险等级",
        rationale:
          "体感最高约 41°C，达到 NWS“危险”等级。这段时间不适合进行剧烈户外活动；应提前补水，不要等到晚间活动时才开始。",
        window: { start: "14:00", end: "17:00" },
        checks: [
          { rule: "heat_index", detail: "体感约 41°C，达到危险等级，也超过你设定的 39°C 避免线", value: 106, band: "危险", thresholdSource: "NWS 体感温度分级", pass: false },
        ],
        severity: "alert",
        status: "auto",
        evidence: ["逐小时预报（演示数据）", "NWS 体感温度分级"],
      },
      {
        id: "i4",
        activityId: "a5",
        kind: "shift",
        title: "遛狗推迟到 20:45",
        rationale:
          "20:00 的体感仍约 36°C，超过你的提醒线，路面也可能烫伤犬爪；到 20:45 太阳完全落下，体感会降到约 33°C。",
        originalWindow: { start: "20:00", end: "20:30" },
        window: { start: "20:45", end: "21:15" },
        checks: [
          { rule: "heat_index", detail: "20:00 体感约 36°C，高于你设定的 35°C 提醒线", value: 96, band: "需要格外注意", thresholdSource: "个人高温提醒", pass: false },
          { rule: "heat_index", detail: "20:45 体感约 33°C，回到提醒线以下", value: 92, band: "需要格外注意", thresholdSource: "个人高温提醒", pass: true },
        ],
        severity: "caution",
        status: "proposed",
        evidence: ["逐小时预报（演示数据）"],
      },
      {
        id: "i5",
        kind: "good_window",
        title: "最佳户外时段：06:30—08:30",
        rationale:
          "紫外线较低，体感低于 29°C，AQI 在 50 左右，花粉浓度较低。今天若还有其他户外事项，优先放在这段时间。",
        window: { start: "06:30", end: "08:30" },
        checks: [
          { rule: "window_score", detail: "整个时段内，四项环境信号均处于适宜或尚可范围", value: null, band: "适宜", thresholdSource: "综合暴露评估", pass: true },
        ],
        severity: "great",
        status: "auto",
        evidence: ["多信号时段扫描（演示数据）"],
      },
    ],
  },
  {
    id: "p2",
    date: "2026-08-01",
    location: HOME,
    status: "draft",
    dayScore: 44,
    summary:
      "周六的条件比今天更差：中午紫外线指数达到 11（极高），体感约 42°C，AQI 接近 102。若 09:00 才开始徒步，会直接进入最不适宜的时段。",
    items: [
      {
        id: "i6",
        activityId: "a4",
        kind: "shift",
        title: "徒步从 09:00 提前到 07:00",
        rationale:
          "若 09:00 出发，最后一小时会遇到 9 以上的紫外线指数和约 38°C 的体感；07:00 出发可以在条件最差前完成三小时路线。",
        originalWindow: { start: "09:00", end: "12:00" },
        window: { start: "07:00", end: "10:00" },
        checks: [
          { rule: "uv_band", detail: "11:00 紫外线指数达到 9（很高），超过你设定的 8 避免线", value: 9, band: "很高", thresholdSource: "个人紫外线避免线", pass: false },
          { rule: "heat_index", detail: "中午体感约 38°C，高于你设定的 35°C 提醒线", value: 100, band: "需要格外注意", thresholdSource: "个人高温提醒", pass: false },
          { rule: "window_score", detail: "07:00—10:00 时段通过全部检查", value: null, band: "尚可", thresholdSource: "综合暴露评估", pass: true },
        ],
        severity: "caution",
        status: "proposed",
        evidence: ["周六逐小时预报（演示数据）"],
      },
      {
        id: "i7",
        activityId: "a4",
        kind: "relocate",
        title: "备选：把山脊路线改为溪谷环线",
        rationale:
          "如果 07:00 太早，Barton Creek 绿带环线约有 70% 的树荫；与无遮挡的山脊路线相比，大约能多争取两小时相对可接受的活动时间。",
        window: { start: "08:00", end: "11:00" },
        checks: [
          { rule: "uv_band", detail: "大部分路段有树荫，可将实际暴露降到你的防护线以下", value: 6, band: "高", thresholdSource: "皮肤类型 II", pass: true },
        ],
        severity: "info",
        status: "proposed",
        evidence: ["路线遮阴估算（演示数据）"],
      },
    ],
  },
  {
    id: "p0",
    date: "2026-07-30",
    location: HOME,
    status: "superseded",
    dayScore: 61,
    summary: "周四午后炎热、早晨尚可；足球训练推迟 30 分钟后，才勉强回到高温避免线以下。",
    items: [
      {
        id: "i0a",
        activityId: "a3",
        kind: "shorten",
        title: "把训练缩短到 60 分钟",
        rationale: "17:30 的体感约 40°C，超过你的避免线。你没有接受缩短建议，教练后来把整场训练推迟了 30 分钟。",
        originalWindow: { start: "17:30", end: "19:00" },
        window: { start: "17:30", end: "18:30" },
        checks: [
          { rule: "heat_index", detail: "开场时体感约 40°C，超过你设定的 39°C 避免线", value: 104, band: "危险", thresholdSource: "个人高温避免线", pass: false },
        ],
        severity: "alert",
        status: "declined",
        feedback: { reason: "团队训练不能缩短。下次请更早提醒，我可以先和教练沟通改时间。" },
        evidence: ["周四逐小时预报（演示数据）"],
      },
    ],
  },
];

export const TODAY_PLAN = PLANS[0];

// ---------- Plan runs ----------

export const PLAN_RUNS: PlanRun[] = [
  {
    id: "r1",
    status: "done",
    startedAt: `${TODAY}T06:02:00`,
    dates: [TODAY, "2026-08-01"],
    report:
      "已重新安排今天和明天：保留 07:00 晨跑，建议把遛狗推迟到 20:45，并为周六徒步提供了两个调整方案。",
  },
];

// ---------- Advisor chat ----------

export const THREADS: Thread[] = [
  { id: "t1", title: "午休时间能跑步吗？", updatedAt: `${TODAY}T12:41:00` },
  { id: "t2", title: "阴天也要防晒吗？", updatedAt: "2026-07-29T18:22:00" },
  { id: "t3", title: "周六徒步怎么安排？", updatedAt: `${TODAY}T06:05:00` },
];

export const MESSAGES: Message[] = [
  {
    id: "m1",
    threadId: "t1",
    role: "user",
    content: "今天午休能不能跑一会儿，替代明天早上的训练？",
    createdAt: `${TODAY}T12:38:00`,
  },
  {
    id: "m2",
    threadId: "t1",
    role: "assistant",
    content:
      "不建议。现在的**紫外线指数是 10（很高）**，体感约 **39°C**，既超过你设定的 35°C 提醒线，也达到紫外线避免线；午休时段的跑步综合评分只有 12/100。\n\n有两个时段通过了全部检查：\n\n- **今晚 20:45—21:30**：体感约 33°C，紫外线指数 0，AQI 降回约 70\n- **明天 06:30—07:15**：未来 36 小时内最合适的时段\n\n要把今晚这段时间加入计划吗？",
    createdAt: `${TODAY}T12:41:00`,
  },
  {
    id: "m3",
    threadId: "t2",
    role: "user",
    content: "今天是阴天，骑车上班真的还需要防晒吗？",
    createdAt: "2026-07-29T18:20:00",
  },
  {
    id: "m4",
    threadId: "t2",
    role: "assistant",
    content:
      "需要。云层不能替代防晒。今天早晨虽然云量达到 **70%**，紫外线指数仍为 **4（中等）**；普通云层下仍可能有大量紫外线到达地面。你的防护规则以实际读数为准：皮肤类型 II 从紫外线指数 3 开始采取防护，不按肉眼看到的天气判断。",
    createdAt: "2026-07-29T18:22:00",
  },
];

// ---------- Briefings ----------

export const BRIEFINGS: Briefing[] = [
  {
    id: "b1",
    title: "晨间简报",
    prompt:
      "每天早晨总结当天计划：当天评分、已安排活动的风险、需要穿戴或携带的物品，以及最适合户外活动的一个时段。",
    cadence: "daily",
    hourLocal: 7,
    enabled: true,
    lastRunAt: `${TODAY}T07:00:00`,
    latestReport:
      "**周五，当天评分 58。** 07:00 晨跑条件合适。下班骑行需准备防晒霜和长袖（紫外线指数 4）。14:00—17:00 高温达到危险等级，不安排剧烈户外活动。遛狗建议推迟到 20:45，等待确认。最佳时段为 06:30—08:30。",
    pastRuns: [
      { date: "2026-07-30", summary: "当天评分 61：训练遇到高温提醒，缩短建议未采用；早晨条件良好。" },
      { date: "2026-07-29", summary: "当天评分 66：虽然阴天，紫外线指数仍为 4，防晒提醒照常触发。" },
      { date: "2026-07-28", summary: "当天评分 71：本周最适合跑步的早晨，长跑建议已采用。" },
    ],
  },
  {
    id: "b2",
    title: "臭氧提醒",
    prompt:
      "当 AQI 达到 101 以上、进入‘对敏感人群不健康’等级时提醒我，并重新检查当天剩余的户外活动。",
    cadence: "on_change",
    trigger: { signal: "aqi", severity: 2 },
    enabled: true,
    lastRunAt: "2026-07-26T15:20:00",
    latestReport:
      "周日 15:00 AQI 达到 104（对敏感人群不健康）。社区花园志愿服务已经结束，无需调整；到 20:00 AQI 降到 88，晚间遛狗通过检查。",
    pastRuns: [{ date: "2026-07-26", summary: "午后臭氧达到敏感人群提醒等级，但没有影响既定安排。" }],
  },
  {
    id: "b3",
    title: "周末展望",
    prompt:
      "每周五 16:00 查看周六和周日的情况：排列适合户外活动的时段，指出与周末计划冲突的风险，并判断哪一天更适合徒步。",
    cadence: "weekly",
    hourLocal: 16,
    enabled: true,
    lastRunAt: "2026-07-24T16:00:00",
    latestReport:
      "两天都比较炎热，但周日略好（AQI 峰值 84，周六为 96）。建议把徒步安排在周日 07:00，而不是周六。",
    pastRuns: [{ date: "2026-07-24", summary: "周日更适合徒步；周六下午不建议安排户外活动。" }],
  },
];

// ---------- Explore (public) ----------

export interface CityConditions {
  location: Location;
  current: { uvIndex: number; usAqi: number; apparentF: number; pollenIdx: number | null };
  daily: DailySummary[];
}

const cityWeek = (
  base: DailySummary[],
  uvShift: number,
  heatShift: number,
  aqiShift: number,
  pollenIdx: number | null
): DailySummary[] =>
  base.map((day) => ({
    ...day,
    uvMax: Math.max(1, day.uvMax + uvShift),
    apparentMaxF: day.apparentMaxF + heatShift,
    tempMaxF: day.tempMaxF + heatShift,
    tempMinF: day.tempMinF + heatShift,
    aqiMax: Math.max(15, day.aqiMax + aqiShift),
    pollen: pollenIdx === null ? null : pollenReading(pollenIdx, ["禾本科"]),
  }));

export const EXPLORE_CITIES: CityConditions[] = [
  {
    location: HOME,
    current: { uvIndex: 10, usAqi: 80, apparentF: 103, pollenIdx: 4.4 },
    daily: WEEK,
  },
  {
    location: { name: "美国 · 菲尼克斯", lat: 33.45, lon: -112.07, tz: "America/Phoenix", zip: "85004" },
    current: { uvIndex: 11, usAqi: 92, apparentF: 111, pollenIdx: 2.1 },
    daily: cityWeek(WEEK, 1, 6, 5, 2.1),
  },
  {
    location: { name: "美国 · 芝加哥", lat: 41.88, lon: -87.63, tz: "America/Chicago", zip: "60601" },
    current: { uvIndex: 7, usAqi: 58, apparentF: 88, pollenIdx: 6.8 },
    daily: cityWeek(WEEK, -3, -16, -30, 6.8),
  },
  {
    location: { name: "德国 · 柏林", lat: 52.52, lon: 13.4, tz: "Europe/Berlin" },
    current: { uvIndex: 5, usAqi: 42, apparentF: 79, pollenIdx: 5.4 },
    daily: cityWeek(WEEK, -5, -25, -45, 5.4),
  },
  {
    location: { name: "尼日利亚 · 拉各斯", lat: 6.52, lon: 3.38, tz: "Africa/Lagos" },
    current: { uvIndex: 8, usAqi: 71, apparentF: 95, pollenIdx: null },
    daily: cityWeek(WEEK, -1, -10, -20, null),
  },
];
