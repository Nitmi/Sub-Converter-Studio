import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clipboard,
  Plus,
  Trash2,
  WandSparkles,
} from "lucide-react";

type TargetOption = { label: string; value: string };
type ToggleKey =
  | "emoji"
  | "udp"
  | "scv"
  | "sort"
  | "append_type"
  | "fdn";

type ProviderItem = {
  id: string;
  name: string;
  url: string;
};

type NodeLinkItem = {
  id: string;
  value: string;
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
  group: "basic" | "advanced";
}> = [
  { key: "emoji", label: "Emoji", description: "设置节点名称是否包含 Emoji", group: "advanced" },
  { key: "udp", label: "UDP", description: "启用 UDP 支持", group: "advanced" },
  { key: "scv", label: "跳过证书验证", description: "跳过证书验证", group: "advanced" },
  { key: "sort", label: "排序节点", description: "让后端按规则重新排序", group: "advanced" },
  { key: "append_type", label: "附加节点类型", description: "将协议类型补到名称中", group: "advanced" },
  { key: "fdn", label: "过滤非法节点", description: "剔除异常节点", group: "advanced" },
];

const PROVIDER_URL_PLACEHOLDER = "https://example.com/sub";
const NODE_LINK_PLACEHOLDER = "vless:// / vmess:// / ss:// / trojan:// ...";

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

const buildImportAction = (target: string, generatedUrl: string, filename: string) => {
  const encodedUrl = encodeURIComponent(generatedUrl);
  const profileTag = filename.trim() || "Sub Converter";
  const encodedProfileName = encodeURIComponent(profileTag);

  if (target === "clash" || target === "clashr") {
    return {
      label: "一键导入 Clash Verge",
      href: `clash://install-config?url=${encodedUrl}`,
    };
  }

  if (target.startsWith("surge")) {
    return {
      label: "一键导入 Surge",
      href: `surge:///install-config?url=${encodedUrl}`,
    };
  }

  if (target === "surfboard") {
    return {
      label: "一键导入 Surfboard",
      href: `surfboard:///install-config?url=${encodedUrl}`,
    };
  }

  if (target === "loon") {
    return {
      label: "一键导入 Loon",
      href: `loon://import?sub=${encodedUrl}`,
    };
  }

  if (target === "quanx") {
    const resource = encodeURIComponent(
      JSON.stringify({
        server_remote: [`${generatedUrl}, tag=${profileTag}`],
      }),
    );

    return {
      label: "一键导入 Quantumult X",
      href: `quantumult-x:///add-resource?remote-resource=${resource}`,
    };
  }

  if (target === "singbox") {
    return {
      label: "一键导入 sing-box",
      href: `sing-box://import-remote-profile?url=${encodedUrl}#${encodedProfileName}`,
    };
  }

  return null;
};

function App() {
  const [backend, setBackend] = useState(DEFAULT_BACKEND);
  const [target, setTarget] = useState("clash");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [filename, setFilename] = useState("");
  const [nodeLinks, setNodeLinks] = useState<NodeLinkItem[]>([
    { id: createId(), value: "" },
  ]);
  const [providers, setProviders] = useState<ProviderItem[]>([
    { id: createId(), name: "", url: "" },
  ]);
  const [customParams, setCustomParams] = useState<CustomParam[]>([]);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    emoji: true,
    udp: true,
    scv: true,
    sort: false,
    append_type: false,
    fdn: false,
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const directEntries = useMemo(
    () => nodeLinks.map((item) => item.value.trim()).filter(Boolean),
    [nodeLinks],
  );

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

  const hasSources = mergedSourceList.length > 0;
  const advancedToggles = TOGGLE_META.filter((item) => item.group === "advanced");

  const generatedUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("target", target);
    params.set("url", mergedSourceList.join("|"));

    if (config.trim()) params.set("config", config.trim());
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
  }, [backend, config, customParams, filename, mergedSourceList, target, toggles]);

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

  const updateNodeLink = (id: string, value: string) => {
    setNodeLinks((current) =>
      current.map((item) => (item.id === id ? { ...item, value } : item)),
    );
  };

  const updateCustomParam = (id: string, key: "key" | "value", value: string) => {
    setCustomParams((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  };

  const importAction = useMemo(
    () => buildImportAction(target, generatedUrl, filename),
    [filename, generatedUrl, target],
  );

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
            <span>订阅转换链接生成器</span>
          </div>
        </div>
        <a
          className="header-link"
          href="https://github.com/Nitmi/Sub-Converter-Studio"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>

      <main>
        <section className="workspace">
          <motion.section
            className="panel panel-form"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-heading">
              <span>配置</span>
              <h2>订阅转换</h2>
            </div>

            <div className="field-grid two">
              <label className="field">
                <span>文件名</span>
                <input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="" />
              </label>
              <label className="field">
                <span>客户端</span>
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
                <span>后端地址</span>
                <input value={backend} onChange={(event) => setBackend(event.target.value)} placeholder={DEFAULT_BACKEND} />
              </label>
            </div>

            <div className="provider-head custom-head">
              <div>
                <span>订阅链接</span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setProviders((current) => [...current, { id: createId(), name: "", url: "" }])
                }
              >
                <Plus size={16} />
                添加订阅
              </button>
            </div>

            <div className="stack-list">
              <AnimatePresence initial={false}>
                {providers.map((item) => (
                  <motion.div
                    key={item.id}
                    className="stack-item"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.24 }}
                  >
                    <div className="field-grid provider-grid">
                      <label className="field">
                        <span>订阅备注</span>
                        <input
                          value={item.name}
                          onChange={(event) => updateProvider(item.id, "name", event.target.value)}
                          placeholder="例如：xx机场"
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
                        className="icon-button icon-button-end"
                        aria-label="删除订阅链接"
                        onClick={() =>
                          setProviders((current) => current.filter((provider) => provider.id !== item.id))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="provider-head">
              <div>
                <span>节点链接</span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setNodeLinks((current) => [...current, { id: createId(), value: "" }])
                }
              >
                <Plus size={16} />
                添加节点
              </button>
            </div>

            <div className="stack-list">
              <AnimatePresence initial={false}>
                {nodeLinks.map((item) => (
                  <motion.div
                    key={item.id}
                    className="stack-item"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.24 }}
                  >
                    <div className="field-grid simple-grid">
                      <label className="field field-wide">
                        <span>节点链接</span>
                        <input
                          value={item.value}
                          onChange={(event) => updateNodeLink(item.id, event.target.value)}
                          placeholder={NODE_LINK_PLACEHOLDER}
                        />
                      </label>
                      <button
                        type="button"
                        className="icon-button icon-button-end"
                        aria-label="删除节点链接"
                        onClick={() =>
                          setNodeLinks((current) => current.filter((node) => node.id !== item.id))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <details className="advanced-panel">
              <summary>
                <span>高级选项</span>
                <p>额外开关和自定义参数</p>
              </summary>

              <div className="advanced-body">
                <div className="toggle-grid advanced-toggle-grid">
                  {advancedToggles.map((item) => (
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
              </div>
            </details>
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
              <h2>生成结果</h2>
            </div>

            {hasSources ? (
              <div className="result-box result-actions">
                <div className="action-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleCopy("url", generatedUrl)}
                  >
                    {copiedField === "url" ? <Check size={16} /> : <Clipboard size={16} />}
                    复制链接
                  </button>
                  {importAction && (
                    <a className="primary-link" href={importAction.href}>
                      {importAction.label}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>还没有可转换的内容</strong>
                <p>先添加节点链接，或在“订阅链接”里添加至少一个订阅后，再生成和导入。</p>
              </div>
            )}
          </motion.aside>
        </section>
      </main>
    </div>
  );
}

export default App;
