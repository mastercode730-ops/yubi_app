// Excel export (the web pages' "Export Excel" buttons). Builds the workbook
// on-device with SheetJS, writes it to the cache dir and opens the share
// sheet so it can be saved to Files / sent on WhatsApp / email.
import * as XLSX from 'xlsx';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { toast } from '../ui/Toast';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// sheets: [{ name, rows: [[header...], [cells...], ...] }]
export async function exportWorkbook(fileName, sheets) {
  const usable = (sheets || []).filter((s) => s && s.rows && s.rows.length > 1);
  if (!usable.length) { toast('No data to export!', 'error'); return false; }
  try {
    const wb = XLSX.utils.book_new();
    usable.forEach((s) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), String(s.name).slice(0, 31)));
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const safe = String(fileName || 'Export').replace(/[^a-zA-Z0-9_\-]/g, '_') + '.xlsx';
    const file = new File(Paths.cache, safe);
    file.create({ overwrite: true });
    await file.write(b64, { encoding: 'base64' });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, dialogTitle: safe, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
    } else {
      toast(`Saved ${safe}`, 'success');
    }
    return true;
  } catch (e) {
    toast('Could not export: ' + (e?.message || 'unknown error'), 'error');
    return false;
  }
}
