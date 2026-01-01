const makeTileKey = (q: number, r: number) => `${q}_${r}`;

const parseTileKey = (key: string) => {
    const parts = key.split("_");
    return { q: tonumber(parts[0])!, r: tonumber(parts[1])! };
};

export { makeTileKey, parseTileKey };
