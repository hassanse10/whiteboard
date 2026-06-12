const ADJECTIVES = ["Quick", "Brave", "Calm", "Clever", "Bold", "Bright", "Gentle", "Swift"];
const ANIMALS = ["Fox", "Otter", "Hawk", "Panda", "Wolf", "Falcon", "Lynx", "Heron"];

export const COLLABORATOR_COLORS = [
  "#e03131",
  "#2f9e44",
  "#1971c2",
  "#f08c00",
  "#9c36b5",
  "#0c8599",
  "#e8590c",
  "#37b24d"
];

export type Identity = {
  name: string;
  color: string;
};

export function generateIdentity(): Identity {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const number = Math.floor(Math.random() * 99) + 1;
  const color = COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)];

  return { name: `${adjective} ${animal} ${number}`, color };
}

const STORAGE_KEY = "whiteboard-identity";

export function getOrCreateIdentity(): Identity {
  if (typeof window === "undefined") {
    return { name: "", color: COLLABORATOR_COLORS[0] };
  }

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Identity;
    } catch {
      // fall through and generate a fresh identity
    }
  }

  const identity = generateIdentity();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}
