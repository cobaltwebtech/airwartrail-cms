import { App } from "@/worker/api/entry";

const worker: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    return await App.fetch(request, env, ctx);
  },
};

export default worker;
