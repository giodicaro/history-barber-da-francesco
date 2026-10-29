// npm test: node --import ./tests/registra-alias.mjs --test …
import { register } from "node:module";

register("./alias.mjs", import.meta.url);
