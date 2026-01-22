import type { CoreType } from '../store/serversStore';

export const CORE_TYPES: {
  value: CoreType;
  label: string;
  desc: string;
}[] = [
  {
    value: 'vanilla',
    label: 'Vanilla（原版）',
    desc: '官方原版伺服器，最穩定但效能較差，不支援插件/模組。'
  },
  {
    value: 'paper',
    label: 'Paper（插件服｜高效）',
    desc: '支援 Plugins（插件），效能最好，適合多人伺服器。'
  },
  {
    value: 'fabric',
    label: 'Fabric（模組服｜輕量）',
    desc: '支援 Fabric Mods，較輕量，適合想玩模組又希望順暢。'
  },
  {
    value: 'forge',
    label: 'Forge（模組服｜大型模組包）',
    desc: '支援 Forge Mods，模組最多，但較吃 RAM。'
  }
];

export const getCoreTypeInfo = (value: CoreType) =>
  CORE_TYPES.find((item) => item.value === value) ?? {
    value,
    label: value,
    desc: ''
  };
