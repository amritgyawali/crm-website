// Daily backup: run from cron, e.g.  30 23 * * *  cd /srv/crm && npm run backup
import { makeBackup } from "../src/lib/backup";

makeBackup()
  .then((b) => console.log(`Backup written: ${b.file} (${Math.round(b.size / 1024)} KB)`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
