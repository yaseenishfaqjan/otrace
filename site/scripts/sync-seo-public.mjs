import { syncPublicSeo } from './seo-public.mjs';

const result = syncPublicSeo();
console.log(`synced llms.txt (${result.llmsBytes} bytes) and /${result.key}.txt`);
