"use client";

import { useEffect, useState } from "react";
import { Card, ConditionTile } from "@/components/ui";
import { useToast } from "@/components/toast";
import { aqiBand, heatBand, pollenBand, uvBand } from "@/lib/bands";
import { getConditions, patchSettings, searchCities } from "@/lib/api";
import { EXPLORE_CITIES } from "@/lib/mock";
import { invalidateMe, useMe } from "@/lib/use-me";
import { fmtTempF } from "@/lib/format";
import type { DailySummary, Location } from "@/lib/types";

const CELL_BG = ["bg-band-0", "bg-band-1", "bg-band-2", "bg-band-3", "bg-band-4"];

interface CityCard {
  location: Location;
  current: { uvIndex: number; usAqi: number; apparentF: number; pollenIdx: number | null };
  daily: DailySummary[];
  live: boolean;
}

const SAMPLE_CARDS: CityCard[] = EXPLORE_CITIES.map((c) => ({ ...c, live: false }));

export default function ExplorePage() {
  const toast = useToast();
  const { me } = useMe();
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<CityCard[]>(SAMPLE_CARDS);
  const [offline, setOffline] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function setAsHome(loc: Location) {
    try {
      await patchSettings({ homeLocation: loc });
      invalidateMe();
      toast("success", `常住地已设为 ${loc.name}，今日建议和本周安排会同步更新。`);
    } catch {
      toast("error", "暂时无法保存常住地，请稍后再试。 ");
    }
  }

  // Upgrade the featured cities from sample to live on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        EXPLORE_CITIES.map((c) =>
          getConditions({
            lat: c.location.lat,
            lon: c.location.lon,
            zip: c.location.zip,
            name: c.location.name,
          })
        )
      );
      if (cancelled) return;
      if (results.every((r) => r.status === "rejected")) {
        setOffline(true);
        return;
      }
      setCards((prev) =>
        prev.map((card, i) => {
          const r = results[i];
          if (r.status !== "fulfilled") return card;
          const d = r.value;
          return {
            location: { ...card.location, ...d.location },
            current: {
              uvIndex: d.current.uvIndex,
              usAqi: d.current.usAqi,
              apparentF: d.current.apparentF,
              pollenIdx: d.current.pollen?.index ?? null,
            },
            daily: d.daily,
            live: true,
          };
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2 || offline || searching) return;
    setSearching(true);
    setNotice(null);
    try {
      const hits = await searchCities(q);
      if (hits.length === 0) {
        setNotice(`没有找到“${q}”。`);
        return;
      }
      const top = hits[0];
      const d = await getConditions({ lat: top.lat, lon: top.lon, name: top.name });
      const card: CityCard = {
        location: top,
        current: {
          uvIndex: d.current.uvIndex,
          usAqi: d.current.usAqi,
          apparentF: d.current.apparentF,
          pollenIdx: d.current.pollen?.index ?? null,
        },
        daily: d.daily,
        live: true,
      };
      setCards((prev) => [card, ...prev.filter((c) => c.location.name !== top.name)]);
      setQuery("");
    } catch {
      setNotice("搜索暂时不可用，当前展示演示城市。 ");
    } finally {
      setSearching(false);
    }
  }

  const visible = cards.filter((c) =>
    c.location.name.toLowerCase().includes(query.toLowerCase())
  );
  const shown = visible.length > 0 ? visible : cards;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">城市环境</h1>
        <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          无需登录即可查询任意城市的紫外线、体感温度、空气质量和花粉情况。
        </p>
        <div className="mt-4 flex max-w-md items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder={offline ? "服务暂不可用，正在筛选演示城市…" : "搜索任意城市…"}
            className="flex-1 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm placeholder:text-ink-muted"
          />
          <button
            onClick={runSearch}
            disabled={offline || searching}
            className="btn-primary px-4 py-2.5 text-sm"
          >
            {searching ? "…" : "搜索"}
          </button>
        </div>
        {notice && <p className="mt-2 text-xs text-ink-muted">{notice}</p>}
        {offline && (
          <p className="mt-2 text-xs text-ink-muted">
            暂时无法连接环境数据服务，以下卡片目前展示演示数据。
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        {shown.map((c) => {
          const worstByDay = c.daily.map((day) =>
            Math.max(
              uvBand(day.uvMax).severity,
              heatBand(day.apparentMaxF).severity,
              aqiBand(day.aqiMax).severity,
              day.pollen ? pollenBand(day.pollen.index).severity : 0
            )
          );
          return (
            <Card key={c.location.name}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] font-semibold tracking-tight">
                    {c.location.name}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      c.live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
                    }`}
                  >
                    {c.live ? "实时" : "演示"}
                  </span>
                  {me && me.homeLocation.name !== c.location.name && (
                    <button
                      onClick={() => setAsHome(c.location)}
                      className="btn-ghost px-2.5 py-0.5 text-[11px]"
                    >
                      设为常住地
                    </button>
                  )}
                  {me && me.homeLocation.name === c.location.name && (
                    <span className="text-[11px] font-medium text-accent">常住地</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="mr-1 text-[11px] text-ink-muted">未来 7 天</span>
                  {worstByDay.map((sev, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={`inline-block size-2.5 rounded-full ${CELL_BG[sev]} opacity-90`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ConditionTile label="紫外线指数" value={String(c.current.uvIndex)} band={uvBand(c.current.uvIndex)} trend={c.daily.map((d) => d.uvMax)} kind="uv" />
                <ConditionTile label="体感温度" value={fmtTempF(c.current.apparentF).replace("°C", "")} unit="°C" band={heatBand(c.current.apparentF)} trend={c.daily.map((d) => d.apparentMaxF)} kind="heat" />
                <ConditionTile label="空气质量（美国 AQI）" value={String(c.current.usAqi)} band={aqiBand(c.current.usAqi)} trend={c.daily.map((d) => d.aqiMax)} kind="air" />
                <ConditionTile
                  label="花粉指数"
                  value={c.current.pollenIdx === null ? "–" : c.current.pollenIdx.toFixed(1)}
                  band={c.current.pollenIdx === null ? undefined : pollenBand(c.current.pollenIdx)}
                  noCoverage={c.current.pollenIdx === null}
                  kind="pollen"
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="如何理解这些等级">
        <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <div className="font-medium">紫外线指数（WHO）</div>
            <p className="mt-1 leading-relaxed text-ink-2">
              0, 2 低 · 3, 5 中等 · 6, 7 高 · 8, 10 很高 · 11 以上极高。
              从中等级别开始就应考虑防护；即使是阴天，紫外线也可能达到这个级别。
            </p>
          </div>
          <div>
            <div className="font-medium">美国 AQI（EPA）</div>
            <p className="mt-1 leading-relaxed text-ink-2">
              0, 50 优 · 51, 100 良 · 101, 150 对敏感人群不健康 · 151, 200 不健康 ·
              201 以上非常不健康。活动强度越高，吸入污染物的量也越大。
            </p>
          </div>
          <div>
            <div className="font-medium">体感温度（NWS）</div>
            <p className="mt-1 leading-relaxed text-ink-2">
              体感低于约 27°C 为舒适；27, 32°C 需要注意，32, 39°C 需要格外注意，
              39, 51°C 为危险。湿度会显著放大高温带来的风险。
            </p>
          </div>
          <div>
            <div className="font-medium">花粉指数（0, 12）</div>
            <p className="mt-1 leading-relaxed text-ink-2">
              低于 2.5 为低，4.9 以下为较低，7.3 以下为中等，9.7 以下为较高，超过后为高。
              花粉数据有地区限制；没有可靠数据时，AirAware 会明确说明，不会猜测。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
