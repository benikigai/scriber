export function argValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function requiredArg(name: string, envName: string) {
  const value = argValue(name) ?? process.env[envName];
  if (!value) throw new Error(`Missing --${name} or ${envName}`);
  return value;
}

export function boolArg(name: string, envName: string, fallback = false) {
  const value = argValue(name) ?? process.env[envName];
  if (value === undefined) return fallback;
  return value === "1" || value === "true";
}
