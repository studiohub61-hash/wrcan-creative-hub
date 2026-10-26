import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * WhatsApp-style emoji keyboard: categories, search and recently used.
 * Pure data + CSS — no extra dependency, so it stays light on data.
 */

type Group = { key: string; label: string; icon: string; emojis: string[] };

export const EMOJI_GROUPS: Group[] = [
  {
    key: "smileys",
    label: "Smileys & People",
    icon: "😀",
    emojis:
      "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊 💋 💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💯 💢 💥 💫 💦 💨 🕳️ 💬 🗨️ 🗯️ 💭 💤".split(
        " ",
      ),
  },
  {
    key: "gestures",
    label: "Gestures & Body",
    icon: "👍",
    emojis:
      "👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦿 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🫃 🫄 🍼 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 👯 🧖 🧗 🤺 🏇 ⛷️ 🏂 🏌️ 🏄 🚣 🏊 ⛹️ 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🛀 🛌 👭 👫 👬 💏 💑 👪 🗣️ 👤 👥".split(
        " ",
      ),
  },
  {
    key: "animals",
    label: "Animals & Nature",
    icon: "🐶",
    emojis:
      "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🐒 🐔 🐧 🐦 🐤 🐣 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🦗 🕷️ 🦂 🐢 🐍 🦎 🦖 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🐃 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐈 🪶 🐓 🦃 🦚 🦜 🦢 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🌵 🎄 🌲 🌳 🌴 🪴 🌱 🌿 ☘️ 🍀 🎍 🎋 🍃 🍂 🍁 🍄 🐚 🪨 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌜 🌛 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 ☔ ☂️ 🌊 🌫️".split(
        " ",
      ),
  },
  {
    key: "food",
    label: "Food & Drink",
    icon: "🍔",
    emojis:
      "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🦴 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 🫖 ☕ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽️ 🥣 🥡 🥢 🧂".split(
        " ",
      ),
  },
  {
    key: "activity",
    label: "Activity & Work",
    icon: "⚽",
    emojis:
      "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩 💼 📈 📉 📊 🧾 💳 💰 💵 💴 💶 💷 🪙 💸 🧮 📚 📖 📝 ✏️ 🖊️ 📌 📎 🗂️ 📅 🗓️ 📋 🔍 🔑 🛠️ ⚙️ 🧰 🔧 🔨 🪚 🧲 🧪 🔬 🔭 📡 💡 🔦 🕯️ 🧯 🛒".split(
        " ",
      ),
  },
  {
    key: "travel",
    label: "Travel & Places",
    icon: "🚗",
    emojis:
      "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍️ 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🪝 ⛽ 🚧 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️ 🗾 🎑 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁".split(
        " ",
      ),
  },
  {
    key: "symbols",
    label: "Symbols & Flags",
    icon: "🎉",
    emojis:
      "🎉 🎊 🎈 🎁 🎀 🪄 🎗️ 🎃 🎄 🧨 ✨ 🪅 🎏 🎐 🧧 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 💯 🔔 🔕 📢 📣 💬 ♻️ ⚠️ 🚫 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ ♠️ ♥️ ♦️ ♣️ 🔺 🔻 🔷 🔶 🕐 ⌛ ⏰ ⏳ 🔒 🔓 🛡️ ⚖️ 🔗 ⛓️ 🏳️ 🏴 🏁 🚩 🏳️‍🌈 🇿🇦 🇳🇬 🇬🇭 🇰🇪 🇧🇼 🇿🇼 🇲🇿 🇱🇸 🇸🇿 🇳🇦 🇬🇧 🇺🇸 🇨🇦 🇦🇺 🇮🇳 🇨🇳 🇧🇷 🇫🇷 🇩🇪".split(
        " ",
      ),
  },
];

const RECENT_KEY = "wanda.recentEmojis";

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 32) : [];
  } catch {
    return [];
  }
}

export function pushRecentEmoji(emoji: string) {
  const next = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, 32);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(EMOJI_GROUPS[0]!.key);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => setRecent(readRecent()), []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term) {
      const hits = EMOJI_GROUPS.filter((g) => g.label.toLowerCase().includes(term)).flatMap(
        (g) => g.emojis,
      );
      return hits.length ? hits : EMOJI_GROUPS.flatMap((g) => g.emojis);
    }
    return EMOJI_GROUPS.find((g) => g.key === group)?.emojis ?? [];
  }, [q, group]);

  const choose = (emoji: string) => {
    pushRecentEmoji(emoji);
    setRecent(readRecent());
    onPick(emoji);
  };

  return (
    <div className="glass-plate absolute bottom-full left-0 right-0 z-30 mb-2 rounded-2xl p-3 animate-fade-in">
      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search emoji"
            className="rose-plate w-full rounded-xl py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button type="button" aria-label="Close emoji keyboard" onClick={onClose} className="p-2">
          <X className="h-4 w-4" />
        </button>
      </div>

      {recent.length && !q ? (
        <>
          <p className="mb-1 text-[0.6rem] tracking-widest text-muted-foreground uppercase">
            Recent
          </p>
          <div className="mb-2 flex flex-wrap gap-1">
            {recent.slice(0, 16).map((e, i) => (
              <button
                key={`${e}-${i}`}
                type="button"
                onClick={() => choose(e)}
                className="rounded-lg p-1 text-xl hover:bg-accent"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto pr-1">
        {list.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => choose(e)}
            className="rounded-lg p-1 text-xl hover:bg-accent"
          >
            {e}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        {EMOJI_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            aria-label={g.label}
            onClick={() => {
              setQ("");
              setGroup(g.key);
            }}
            className={`rounded-lg px-2 py-1 text-lg ${
              group === g.key && !q ? "bg-accent" : "opacity-60"
            }`}
          >
            {g.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
