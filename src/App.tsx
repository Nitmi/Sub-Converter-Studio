import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clipboard,
  Link2,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";

type TargetOption = { label: string; value: string };
type ToggleKey =
  | "emoji"
  | "udp"
  | "scv"
  | "new_name"
  | "sort"
  | "append_type"
  | "fdn"
  | "expand"
  | "list";

type ProviderItem = {
  id: string;
  name: string;
  url: string;
};

type CustomParam = {
  id: string;
  key: string;
  value: string;
};

const DEFAULT_BACKEND =
  import.meta.env.VITE_DEFAULT_BACKEND ?? "https://api.asailor.org";
const DEFAULT_CONFIG =
  import.meta.env.VITE_DEFAULT_CONFIG ??
  "https://gh.123778.xyz/Nitmi_Rules/main/convert/Custom_Clash_Full.ini";

const TARGETS: TargetOption[] = [
  { label: "Clash", value: "clash" },
  { label: "ClashR", value: "clashr" },
  { label: "Surge 4", value: "surge&ver=4" },
  { label: "Surge 3", value: "surge&ver=3" },
  { label: "Quantumult X", value: "quanx" },
  { label: "Quantumult", value: "quan" },
  { label: "Loon", value: "loon" },
  { label: "sing-box", value: "singbox" },
  { label: "Surfboard", value: "surfboard" },
  { label: "V2Ray", value: "v2ray" },
  { label: "Trojan", value: "trojan" },
  { label: "SS", value: "ss" },
  { label: "SSR", value: "ssr" },
];

const TOGGLE_META: Array<{
  key: ToggleKey;
  label: string;
  description: string;
}> = [
  { key: "emoji", label: "Emoji", description: "为节点名称追加表情" },
  { key: "udp", label: "UDP", description: "启用 UDP 支持" },
  { key: "scv", label: "跳过证书验证", description: "向后端传递 scv=true" },
  { key: "new_name", label: "Clash 新字段", description: "增强版和 Clash 常用选项" },
  { key: "sort", label: "排序节点", description: "让后端按规则重新排序" },
  { key: "append_type", label: "附加节点类型", description: "将协议类型补到名称中" },
  { key: "fdn", label: "过滤非法节点", description: "剔除异常节点" },
  { key: "expand", label: "规则展开", description: "展开规则组内容" },
  { key: "list", label: "Node List", description: "输出为节点列表" },
];

const DIRECT_SOURCE_PLACEHOLDER = `支持订阅链接或节点链接
多个条目可每行一条，也可用 | 分隔

示例：
https://example.com/sub
vless://uuid@example.com:443?...#Node`;

const PROVIDER_URL_PLACEHOLDER = "https://example.com/sub";

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const splitEntries = (value: string) =>
  value
    .split(/\r?\n|\|/g)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeBackend = (input: string) => {
  const trimmed = input.trim().replace(/\?+$/, "");
  if (!trimmed) {
    return `${DEFAULT_BACKEND}/sub?`;
  }
  if (trimmed.includes("/sub")) {
    return trimmed.endsWith("?") ? trimmed : `${trimmed}?`;
  }
  return `${trimmed.replace(/\/+$/, "")}/sub?`;
};

const isProviderNameValid = (value: string) => /^[\p{L}\p{N}_-]+$/u.test(value);

const hashLike = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
};

const buildProviderName = (rawName: string, url: string, used: Map<string, number>) => {
  const trimmed = rawName.trim();
  const base =
    trimmed && isProviderNameValid(trimmed)
      ? trimmed
      : `Provider_${hashLike(`${trimmed}|${url}`)}`;
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}_${count}`;
};

const buildProviderSegment = (providerName: string, url: string) =>
  `provider:${providerName},${url.trim()}`;

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

function App() {
  const [backend, setBackend] = useState(DEFAULT_BACKEND);
  const [target, setTarget] = useState("clash");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [filename, setFilename] = useState("自建_recfg");
  const [directSources, setDirectSources] = useState("");
  const [providers, setProviders] = useState<ProviderItem[]>([
    { id: createId(), name: "WestData", url: "" },
    { id: createId(), name: "PeiQian", url: "" },
  ]);
  const [customParams, setCustomParams] = useState<CustomParam[]>([]);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    emoji: true,
    udp: true,
    scv: true,
    new_name: true,
    sort: false,
    append_type: false,
    fdn: false,
    expand: true,
    list: false,
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const directEntries = useMemo(() => splitEntries(directSources), [directSources]);

  const preparedProviders = useMemo(() => {
    const usedNames = new Map<string, number>();
    return providers
      .filter((item) => item.url.trim())
      .map((item) => {
        const resolvedName = buildProviderName(item.name, item.url, usedNames);
        return {
          ...item,
          resolvedName,
          segment: buildProviderSegment(resolvedName, item.url),
        };
      });
  }, [providers]);

  const mergedSourceList = useMemo(
    () => [...directEntries, ...preparedProviders.map((item) => item.segment)],
    [directEntries, preparedProviders],
  );

  const generatedUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("target", target);
    params.set("url", mergedSourceList.join("|"));

    if (config.trim()) params.set("config", config.trim());
    if (include.trim()) params.set("include", include.trim());
    if (exclude.trim()) params.set("exclude", exclude.trim());
    if (filename.trim()) params.set("filename", filename.trim());

    Object.entries(toggles).forEach(([key, value]) => {
      params.set(key, String(value));
    });

    customParams.forEach((item) => {
      if (item.key.trim() && item.value.trim()) {
        params.set(item.key.trim(), item.value.trim());
      }
    });

    return `${normalizeBackend(backend)}${params.toString()}`;
  }, [backend, config, customParams, exclude, filename, include, mergedSourceList, target, toggles]);

  const providerHint = useMemo(() => {
    if (preparedProviders.length === 0) {
      return "当前没有启用 proxy-providers。";
    }
    return preparedProviders
      .map((item) => `${item.resolvedName} -> ${item.url.trim()}`)
      .join("\n");
  }, [preparedProviders]);

  const summary = useMemo(
    () => [
      { label: "目标格式", value: TARGETS.find((item) => item.value === target)?.label ?? target },
      { label: "直连条目", value: String(directEntries.length) },
      { label: "Providers", value: String(preparedProviders.length) },
      { label: "附加参数", value: String(customParams.filter((item) => item.key && item.value).length) },
    ],
    [customParams, directEntries.length, preparedProviders.length, target],
  );

  const handleCopy = async (field: string, value: string) => {
    await copyText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1600);
  };

  const updateProvider = (id: string, key: "name" | "url", value: string) => {
    setProviders((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  };

  const updateCustomParam = (id: string, key: "key" | "value", value: string) => {
    setCustomParams((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  };

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-a" />
      <div className="backdrop backdrop-b" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <WandSparkles size={18} />
          </div>
          <div>
            <p>Sub Converter Studio</p>
            <span>视觉化生成增强版与常规版订阅转换链接</span>
          </div>
        </div>
        <a
          className="ghost-link"
          href="https://github.com/Aethersailor/SubConverter-Extended"
          target="_blank"
          rel="noreferrer"
        >
          后端说明
        </a>
      </header>

      <main>
        <section className="hero">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow">Subscription Conversion</span>
            <h1>把复杂参数折叠成一张干净、可读、可复制的工作台。</h1>
            <p>
              首屏直接完成目标格式、过滤规则、增强参数与
              <strong> proxy-providers </strong>
              的可视化配置，最终输出可落地的订阅转换链接。
            </p>
            <div className="hero-meta">
              <div>
                <ShieldCheck size={16} />
                兼容增强版与常规 SubConverter
              </div>
              <div>
                <Sparkles size={16} />
                Provider 名称自动去重与回退
              </div>
            </div>
          </motion.div>

          <motion.aside
            className="hero-panel"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="summary-grid">
              {summary.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="preview-block">
              <label>URL 列表预览</label>
              <pre>{mergedSourceList.length ? mergedSourceList.join("\n") : "等待输入源链接或 provider..."}</pre>
            </div>
          </motion.aside>
        </section>

        <section className="workspace">
          <motion.section
            className="panel panel-form"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-heading">
              <span>生成器</span>
              <h2>配置你的转换参数</h2>
            </div>

            <div className="field-grid two">
              <label className="field">
                <span>后端地址</span>
                <input value={backend} onChange={(event) => setBackend(event.target.value)} placeholder={DEFAULT_BACKEND} />
              </label>
              <label className="field">
                <span>目标格式</span>
                <select value={target} onChange={(event) => setTarget(event.target.value)}>
                  {TARGETS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-grid two">
              <label className="field">
                <span>配置 URL</span>
                <input value={config} onChange={(event) => setConfig(event.target.value)} placeholder={DEFAULT_CONFIG} />
              </label>
              <label className="field">
                <span>文件名</span>
                <input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="自建_recfg" />
              </label>
            </div>

            <div className="field-grid two">
              <label className="field">
                <span>Include</span>
                <input value={include} onChange={(event) => setInclude(event.target.value)} placeholder="香港|台湾" />
              </label>
              <label className="field">
                <span>Exclude</span>
                <input value={exclude} onChange={(event) => setExclude(event.target.value)} placeholder="过期|剩余" />
              </label>
            </div>

            <label className="field">
              <span>直连源条目</span>
              <textarea
                value={directSources}
                onChange={(event) => setDirectSources(event.target.value)}
                placeholder={DIRECT_SOURCE_PLACEHOLDER}
                rows={6}
              />
            </label>

            <div className="provider-head">
              <div>
                <span>Proxy Providers</span>
                <p>只对订阅链接生效，最终会被拼成 `provider:名称,订阅链接`。</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setProviders((current) => [...current, { id: createId(), name: "", url: "" }])
                }
              >
                <Plus size={16} />
                添加 Provider
              </button>
            </div>

            <div className="stack-list">
              <AnimatePresence initial={false}>
                {providers.map((item, index) => (
                  <motion.div
                    key={item.id}
                    className="stack-item"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.24 }}
                  >
                    <div className="stack-title">Provider {index + 1}</div>
                    <div className="field-grid provider-grid">
                      <label className="field">
                        <span>名称</span>
                        <input
                          value={item.name}
                          onChange={(event) => updateProvider(item.id, "name", event.target.value)}
                          placeholder="WestData"
                        />
                      </label>
                      <label className="field field-wide">
                        <span>订阅链接</span>
                        <input
                          value={item.url}
                          onChange={(event) => updateProvider(item.id, "url", event.target.value)}
                          placeholder={PROVIDER_URL_PLACEHOLDER}
                        />
                      </label>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="删除 provider"
                        onClick={() =>
                          setProviders((current) => current.filter((provider) => provider.id !== item.id))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="resolved-line">
                      解析后名称：
                      {preparedProviders.find((provider) => provider.id === item.id)?.resolvedName ?? "等待有效订阅链接"}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="provider-preview">
              <label>Provider 解析预览</label>
              <pre>{providerHint}</pre>
            </div>

            <div className="provider-head custom-head">
              <div>
                <span>自定义参数</span>
                <p>用于兼容更细的后端选项，不限制键名。</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setCustomParams((current) => [...current, { id: createId(), key: "", value: "" }])
                }
              >
                <Plus size={16} />
                添加参数
              </button>
            </div>

            <div className="stack-list compact">
              {customParams.map((item) => (
                <div key={item.id} className="stack-item">
                  <div className="field-grid custom-grid">
                    <label className="field">
                      <span>Key</span>
                      <input
                        value={item.key}
                        onChange={(event) => updateCustomParam(item.id, "key", event.target.value)}
                        placeholder="insert"
                      />
                    </label>
                    <label className="field field-wide">
                      <span>Value</span>
                      <input
                        value={item.value}
                        onChange={(event) => updateCustomParam(item.id, "value", event.target.value)}
                        placeholder="true"
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="删除参数"
                      onClick={() =>
                        setCustomParams((current) => current.filter((param) => param.id !== item.id))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="toggle-grid">
              {TOGGLE_META.map((item) => (
                <label key={item.key} className={`toggle-card ${toggles[item.key] ? "active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={toggles[item.key]}
                    onChange={(event) =>
                      setToggles((current) => ({
                        ...current,
                        [item.key]: event.target.checked,
                      }))
                    }
                  />
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </motion.section>

          <motion.aside
            className="panel panel-output"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            <div className="section-heading">
              <span>结果</span>
              <h2>生成后的订阅转换链接</h2>
            </div>

            <div className="result-box">
              <textarea value={generatedUrl} readOnly rows={14} />
            </div>

            <div className="action-row">
              <button type="button" className="primary-button" onClick={() => handleCopy("url", generatedUrl)}>
                {copiedField === "url" ? <Check size={16} /> : <Clipboard size={16} />}
                复制链接
              </button>
              <a className="secondary-link" href={generatedUrl} target="_blank" rel="noreferrer">
                <Link2 size={16} />
                新窗口打开
              </a>
            </div>

            <div className="mini-section">
              <label>后端请求地址</label>
              <code>{normalizeBackend(backend)}</code>
            </div>

            <div className="mini-section">
              <label>编码前 `url=` 内容</label>
              <pre>{mergedSourceList.join("|") || "等待输入..."}</pre>
            </div>
          </motion.aside>
        </section>

        <section className="info-strip">
          <div>
            <span>可视化 Provider</span>
            <p>前端会预处理名称为空、非法字符和重名场景，便于你在复制前直接确认结果。</p>
          </div>
          <div>
            <span>兼容双后端</span>
            <p>默认地址是 `https://api.asailor.org`，输入其他 SubConverter 服务也能沿用同一工作流。</p>
          </div>
          <div>
            <span>现代化工作台</span>
            <p>结构是 Vite + React + TypeScript，后续接入解析、短链或模板预设都比较顺手。</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
