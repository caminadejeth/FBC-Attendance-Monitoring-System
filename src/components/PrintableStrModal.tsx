import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, FileText } from 'lucide-react';
import { StockTransferRequisition } from '../types';
import { showActionSuccessToast, showErrorAlert } from '../utils/sweetAlerts';

interface PrintableStrModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: StockTransferRequisition | null;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = (text || '').trim();
  if (!clean) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const PrintableStrModal: React.FC<PrintableStrModalProps> = ({
  isOpen,
  onClose,
  transfer,
}) => {
  const [isSavingImage, setIsSavingImage] = useState(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-str-quarter');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-str-quarter');
    };
  }, []);

  if (!isOpen || !transfer) return null;

  const safeItems = Array.isArray(transfer.items) ? transfer.items : [];
  const activeItems = safeItems.filter((i) => i.itemStatus !== 'CANCELLED');
  const cancelledCount = safeItems.length - activeItems.length;
  const totalQty = activeItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const safeStrRef = transfer.strRefNumber || 'STR';
  const safeTransferNum = transfer.transferNumber || '—';
  const safeDate = transfer.date || '';

  const formatSafeDateTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSaveAsImage = async () => {
    if (isSavingImage) return;
    setIsSavingImage(true);

    try {
      // 1/4 Letter (4.25in x 5.5in) at 300 DPI = 1275 x 1650 px (grows taller if many items)
      const scale = 3; // 1 CSS px (at 96dpi ~408x528) * 3 -> crisp ~1224x1584+
      const width = 408 * scale; // 1224px (exact 4.25in at 288dpi)
      const minHeight = 528 * scale; // 1584px (exact 5.5in at 288dpi)
      const pad = 16 * scale;
      const innerWidth = width - pad * 2;

      const measureCanvas = document.createElement('canvas');
      const mCtx = measureCanvas.getContext('2d');
      if (!mCtx) throw new Error('Canvas not supported');

      // Column widths for items table
      const colW = [
        24 * scale, // #
        142 * scale, // Description
        78 * scale, // Category
        56 * scale, // Batch No
        38 * scale, // UOM
        innerWidth - (24 + 142 + 78 + 56 + 38) * scale, // Qty
      ];

      mCtx.font = `700 ${8.5 * scale}px system-ui, -apple-system, sans-serif`;
      const rowLayouts = safeItems.map((item) => {
        const isCancelled = item.itemStatus === 'CANCELLED';
        const descText = isCancelled
          ? `[CANCELLED] ${item.description || ''}`
          : item.description || '';
        const descLines = wrapCanvasText(mCtx, descText, colW[1] - 8 * scale);
        mCtx.font = `500 ${8 * scale}px system-ui, -apple-system, sans-serif`;
        const catLines = wrapCanvasText(mCtx, item.category || '', colW[2] - 6 * scale);
        const batchLines = wrapCanvasText(mCtx, item.batchNo || '—', colW[3] - 6 * scale);
        mCtx.font = `700 ${8.5 * scale}px system-ui, -apple-system, sans-serif`;
        const lineCount = Math.max(descLines.length, catLines.length, batchLines.length, 1);
        const rowH = Math.max(18 * scale, lineCount * 10.5 * scale + 7 * scale);
        return { item, isCancelled, descLines, catLines, batchLines, rowH };
      });

      const tableRowsH = rowLayouts.reduce((s, r) => s + r.rowH, 0);
      const tableHeaderH = 20 * scale;
      const totalRowH = 20 * scale;

      let remarksLines: string[] = [];
      let remarksBoxH = 0;
      if (transfer.remarks && transfer.remarks.trim()) {
        mCtx.font = `500 ${8.5 * scale}px system-ui, -apple-system, sans-serif`;
        remarksLines = wrapCanvasText(
          mCtx,
          `REMARKS: ${transfer.remarks.trim()}`,
          innerWidth - 12 * scale
        );
        remarksBoxH = remarksLines.length * 11 * scale + 10 * scale;
      }

      const headerBlockH = 56 * scale;
      const metaBlockH = 62 * scale;
      const footerBlockH = 82 * scale;
      const requiredHeight =
        pad * 2 +
        headerBlockH +
        8 * scale +
        metaBlockH +
        8 * scale +
        tableHeaderH +
        tableRowsH +
        totalRowH +
        (remarksBoxH > 0 ? 8 * scale + remarksBoxH : 0) +
        16 * scale +
        footerBlockH;

      const height = Math.max(minHeight, requiredHeight);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      // White paper background & crisp black border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeRect(0.75 * scale, 0.75 * scale, width - 1.5 * scale, height - 1.5 * scale);

      let y = pad;

      // Company Header
      ctx.fillStyle = '#09090b';
      ctx.font = `900 ${13 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText('FBC RESTAURANTS CORP.', pad, y);

      ctx.fillStyle = '#3f3f46';
      ctx.font = `700 ${9 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('YELLOW CAB PIZZA CO. · WAREHOUSE', pad, y + 16 * scale);

      ctx.fillStyle = '#09090b';
      ctx.font = `900 ${10 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('STOCK TRANSFER REQUISITION (STR)', pad, y + 31 * scale);

      // STR Ref # Badge Box (top right)
      ctx.font = `900 ${11 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const refTextW = ctx.measureText(safeStrRef).width;
      const refBoxW = Math.max(88 * scale, refTextW + 18 * scale);
      const refBoxH = 34 * scale;
      const refBoxX = width - pad - refBoxW;
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(refBoxX, y, refBoxW, refBoxH);
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(refBoxX, y, refBoxW, refBoxH);

      ctx.fillStyle = '#52525b';
      ctx.font = `700 ${7.5 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('STR REF #', refBoxX + refBoxW - 7 * scale, y + 5 * scale);

      ctx.fillStyle = '#09090b';
      ctx.font = `900 ${11 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(safeStrRef, refBoxX + refBoxW - 7 * scale, y + 16 * scale);
      ctx.textAlign = 'left';

      // Header bottom rule
      y += 48 * scale;
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();

      y += 8 * scale;

      // Metadata Grid Box
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(pad, y, innerWidth, metaBlockH);
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(pad, y, innerWidth, metaBlockH);

      const midX = pad + innerWidth / 2;
      const midY = y + 30 * scale;
      ctx.strokeStyle = '#d4d4d8';
      ctx.beginPath();
      ctx.moveTo(pad, midY);
      ctx.lineTo(width - pad, midY);
      ctx.stroke();

      // Date & Transfer #
      ctx.fillStyle = '#52525b';
      ctx.font = `700 ${7.5 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('DATE', pad + 6 * scale, y + 4 * scale);
      ctx.fillText('TRANSFER #', midX + 4 * scale, y + 4 * scale);

      ctx.fillStyle = '#09090b';
      ctx.font = `700 ${9.5 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(safeDate, pad + 6 * scale, y + 14 * scale);
      ctx.fillText(safeTransferNum, midX + 4 * scale, y + 14 * scale);

      // From Branch & To Branch
      ctx.fillStyle = '#52525b';
      ctx.font = `700 ${7.5 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('FROM BRANCH (ISSUING)', pad + 6 * scale, midY + 4 * scale);
      ctx.fillText('REQUESTING BRANCH (TO)', midX + 4 * scale, midY + 4 * scale);

      ctx.fillStyle = '#09090b';
      ctx.font = `900 ${9 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(
        `${transfer.fromBranchName} (${transfer.fromBranchCode})`,
        pad + 6 * scale,
        midY + 14 * scale
      );
      ctx.fillText(
        `${transfer.toBranchName} (${transfer.toBranchCode})`,
        midX + 4 * scale,
        midY + 14 * scale
      );

      y += metaBlockH + 8 * scale;

      // Items Table Header
      ctx.fillStyle = '#09090b';
      ctx.fillRect(pad, y, innerWidth, tableHeaderH);

      const headers = ['#', 'DESCRIPTION', 'CATEGORY', 'BATCH NO', 'UOM', 'QTY'];
      let colX = pad;
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${8 * scale}px system-ui, -apple-system, sans-serif`;
      headers.forEach((h, i) => {
        if (i === 0 || i === 4) {
          ctx.textAlign = 'center';
          ctx.fillText(h, colX + colW[i] / 2, y + 6 * scale);
        } else if (i === 5) {
          ctx.textAlign = 'right';
          ctx.fillText(h, colX + colW[i] - 4 * scale, y + 6 * scale);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(h, colX + 4 * scale, y + 6 * scale);
        }
        colX += colW[i];
      });
      ctx.textAlign = 'left';
      y += tableHeaderH;

      // Items Table Rows
      rowLayouts.forEach((row, idx) => {
        ctx.fillStyle = row.isCancelled
          ? '#fff1f2'
          : idx % 2 === 1
          ? '#fafafa'
          : '#ffffff';
        ctx.fillRect(pad, y, innerWidth, row.rowH);

        ctx.strokeStyle = '#a1a1aa';
        ctx.lineWidth = 0.75 * scale;
        ctx.strokeRect(pad, y, innerWidth, row.rowH);

        let cx = pad;
        for (let c = 0; c < colW.length - 1; c++) {
          cx += colW[c];
          ctx.beginPath();
          ctx.moveTo(cx, y);
          ctx.lineTo(cx, y + row.rowH);
          ctx.stroke();
        }

        // #
        ctx.fillStyle = row.isCancelled ? '#9f1239' : '#09090b';
        ctx.font = `600 ${8.5 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), pad + colW[0] / 2, y + 5 * scale);

        // Description
        ctx.textAlign = 'left';
        ctx.font = `700 ${8.5 * scale}px system-ui, -apple-system, sans-serif`;
        row.descLines.forEach((line, lIdx) => {
          ctx.fillText(line, pad + colW[0] + 4 * scale, y + 5 * scale + lIdx * 10.5 * scale);
        });

        // Category
        ctx.fillStyle = row.isCancelled ? '#9f1239' : '#3f3f46';
        ctx.font = `500 ${7.8 * scale}px system-ui, -apple-system, sans-serif`;
        row.catLines.forEach((line, lIdx) => {
          ctx.fillText(
            line,
            pad + colW[0] + colW[1] + 3 * scale,
            y + 5 * scale + lIdx * 10 * scale
          );
        });

        // Batch No
        ctx.fillStyle = row.isCancelled ? '#9f1239' : '#27272a';
        ctx.font = `500 ${8 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        row.batchLines.forEach((line, lIdx) => {
          ctx.fillText(
            line,
            pad + colW[0] + colW[1] + colW[2] + 3 * scale,
            y + 5 * scale + lIdx * 10 * scale
          );
        });

        // UOM
        ctx.fillStyle = row.isCancelled ? '#9f1239' : '#09090b';
        ctx.font = `700 ${8 * scale}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
          (row.item.uom || '').toUpperCase(),
          pad + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] / 2,
          y + 5 * scale
        );

        // Qty
        ctx.font = `900 ${8.5 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(
          row.isCancelled ? '0' : Number(row.item.quantity).toLocaleString(),
          width - pad - 4 * scale,
          y + 5 * scale
        );
        ctx.textAlign = 'left';

        y += row.rowH;
      });

      // Total Row
      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(pad, y, innerWidth, totalRowH);
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(pad, y, innerWidth, totalRowH);

      const qtyDividerX = width - pad - colW[5];
      ctx.beginPath();
      ctx.moveTo(qtyDividerX, y);
      ctx.lineTo(qtyDividerX, y + totalRowH);
      ctx.stroke();

      ctx.fillStyle = '#09090b';
      ctx.font = `900 ${8 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(
        `TOTAL ITEMS (${activeItems.length}${cancelledCount > 0 ? `/${safeItems.length}` : ''} LINES) · TOTAL QTY`,
        qtyDividerX - 6 * scale,
        y + 6 * scale
      );
      ctx.font = `900 ${8.5 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(totalQty.toLocaleString(), width - pad - 4 * scale, y + 6 * scale);
      ctx.textAlign = 'left';
      y += totalRowH;

      // Remarks Box
      if (remarksBoxH > 0) {
        y += 8 * scale;
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(pad, y, innerWidth, remarksBoxH);
        ctx.strokeStyle = '#a1a1aa';
        ctx.lineWidth = 0.75 * scale;
        ctx.strokeRect(pad, y, innerWidth, remarksBoxH);

        ctx.fillStyle = '#18181b';
        ctx.font = `600 ${8 * scale}px system-ui, -apple-system, sans-serif`;
        remarksLines.forEach((line, lIdx) => {
          ctx.fillText(line, pad + 6 * scale, y + 5 * scale + lIdx * 11 * scale);
        });
      }

      // Signatures Footer anchored near bottom
      const footerTopY = height - pad - footerBlockH;
      ctx.save();
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 1 * scale;
      ctx.setLineDash([4 * scale, 3 * scale]);
      ctx.beginPath();
      ctx.moveTo(pad, footerTopY);
      ctx.lineTo(width - pad, footerTopY);
      ctx.stroke();
      ctx.restore();

      const sigY = footerTopY + 8 * scale;
      const sigGap = 10 * scale;
      const sigColW = (innerWidth - sigGap * 2) / 3;
      const receivedSubLabel = transfer.receivedAt
        ? formatSafeDateTime(transfer.receivedAt)
        : 'SIGNATURE & DATE';

      const sigCols = [
        {
          label: 'PREPARED BY:',
          value: (transfer.preparedBy || '________________').toUpperCase(),
          sub: 'PRINTED NAME',
        },
        {
          label: 'REVIEWED BY:',
          value: (transfer.reviewedBy || '________________').toUpperCase(),
          sub: 'WAREHOUSE STAFF',
        },
        {
          label: 'RECEIVED BY:',
          value: (
            transfer.receivedBy ||
            (transfer.status === 'PENDING' ? 'PENDING RECEIPT' : '________________')
          ).toUpperCase(),
          sub: receivedSubLabel.toUpperCase(),
        },
      ];

      sigCols.forEach((col, i) => {
        const sx = pad + i * (sigColW + sigGap);
        ctx.fillStyle = '#52525b';
        ctx.font = `700 ${7.5 * scale}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(col.label, sx, sigY);

        ctx.fillStyle = '#09090b';
        ctx.font = `800 ${8 * scale}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(col.value, sx + sigColW / 2, sigY + 24 * scale, sigColW);

        ctx.strokeStyle = '#09090b';
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(sx, sigY + 36 * scale);
        ctx.lineTo(sx + sigColW, sigY + 36 * scale);
        ctx.stroke();

        ctx.fillStyle = '#52525b';
        ctx.font = `600 ${6.8 * scale}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(col.sub, sx + sigColW / 2, sigY + 40 * scale, sigColW);
      });

      // Bottom metadata strip
      const bottomLineY = height - pad - 14 * scale;
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 0.75 * scale;
      ctx.beginPath();
      ctx.moveTo(pad, bottomLineY - 5 * scale);
      ctx.lineTo(width - pad, bottomLineY - 5 * scale);
      ctx.stroke();

      ctx.fillStyle = '#71717a';
      ctx.font = `600 ${7.2 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'left';
      ctx.fillText('FBC RESTAURANTS CORP. · 1/4 LETTER STR COPY', pad, bottomLineY);
      ctx.textAlign = 'right';
      ctx.fillText(
        `${safeStrRef} · ${transfer.status}`,
        width - pad,
        bottomLineY
      );
      ctx.textAlign = 'left';

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeRef = safeStrRef.replace(/[^a-zA-Z0-9_-]+/g, '_');
      link.download = `STR_${safeRef}_${safeDate}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showActionSuccessToast(`Saved STR ${safeStrRef} as PNG image!`);
    } catch (err) {
      console.error('Failed saving STR image:', err);
      showErrorAlert('Save Image Failed', 'Could not generate the STR image file.');
    } finally {
      setIsSavingImage(false);
    }
  };

  return createPortal(
    <>
      {/* Scoped 1/4 Letter (4.25in x 5.5in) Print Rules — mounted only while modal is open */}
      <style>{`
        @page {
          size: 4.25in 5.5in;
          margin: 0.12in;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body.printing-str-quarter #root {
            display: none !important;
          }
          body.printing-str-quarter .str-no-print {
            display: none !important;
          }
          body.printing-str-quarter .str-print-backdrop {
            position: static !important;
            inset: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
          }
          body.printing-str-quarter .str-print-shell {
            box-shadow: none !important;
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          body.printing-str-quarter #str-printable-sheet {
            width: 4.01in !important;
            min-height: 5.26in !important;
            margin: 0 !important;
            padding: 0.14in !important;
            box-shadow: none !important;
            border: 1px solid #09090b !important;
            background: #ffffff !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="str-print-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
        <div className="str-print-shell bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-[520px] w-full overflow-hidden flex flex-col max-h-[95vh]">
          {/* Modal Toolbar (Hidden when printing) */}
          <div className="str-no-print bg-zinc-950 text-white px-3 sm:px-4 py-3 border-b border-zinc-800 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-wider text-amber-400 truncate">
                  1/4 Letter STR Preview
                </div>
                <div className="text-[11px] text-zinc-400 font-mono truncate">
                  4.25in × 5.5in Bond Paper · {transfer.strRefNumber}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <button
                type="button"
                disabled={isSavingImage}
                onClick={handleSaveAsImage}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                {isSavingImage ? 'Saving...' : 'Save as Image'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer transition-colors shrink-0"
                aria-label="Close Preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Paper Canvas Container */}
          <div className="str-print-shell p-3 sm:p-5 bg-zinc-800/80 overflow-x-auto overflow-y-auto flex justify-start sm:justify-center">
            {/* Exact 1/4 Letter Sheet (4.25in x 5.5in on screen, scaled cleanly to 4.01in x 5.26in inside 0.12in print margins) */}
            <div
              id="str-printable-sheet"
              className="w-[4.25in] min-h-[5.5in] bg-white text-zinc-950 p-[0.16in] border border-zinc-950 shadow-xl flex flex-col justify-between shrink-0 font-sans"
            >
              <div>
                {/* Company Header */}
                <div className="border-b-2 border-zinc-950 pb-1.5 mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-black tracking-tight uppercase leading-none text-zinc-950">
                      FBC Restaurants Corp.
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-700 mt-0.5">
                      Yellow Cab Pizza Co. · Warehouse
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-wide text-zinc-950 mt-1">
                      STOCK TRANSFER REQUISITION (STR)
                    </div>
                  </div>
                  <div className="text-right border border-zinc-950 px-2 py-1 bg-zinc-50 shrink-0">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-zinc-600 leading-none">
                      STR Ref #
                    </div>
                    <div className="text-[11px] font-mono font-black text-zinc-950 leading-tight mt-0.5">
                      {transfer.strRefNumber}
                    </div>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px] border border-zinc-900 p-1.5 mb-2 bg-zinc-50/70">
                  <div>
                    <span className="font-bold uppercase text-[8px] text-zinc-600 block leading-none">
                      Date
                    </span>
                    <span className="font-mono font-bold text-zinc-950">{transfer.date}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[8px] text-zinc-600 block leading-none">
                      Transfer #
                    </span>
                    <span className="font-mono font-bold text-zinc-950">
                      {transfer.transferNumber}
                    </span>
                  </div>
                  <div className="pt-0.5 border-t border-zinc-300">
                    <span className="font-bold uppercase text-[8px] text-zinc-600 block leading-none">
                      From Branch (Issuing)
                    </span>
                    <span className="font-black text-zinc-950">
                      {transfer.fromBranchName}{' '}
                      <span className="font-mono font-semibold text-[8.5px] text-zinc-700">
                        ({transfer.fromBranchCode})
                      </span>
                    </span>
                  </div>
                  <div className="pt-0.5 border-t border-zinc-300">
                    <span className="font-bold uppercase text-[8px] text-zinc-600 block leading-none">
                      Requesting Branch (To Branch)
                    </span>
                    <span className="font-black text-zinc-950">
                      {transfer.toBranchName}{' '}
                      <span className="font-mono font-semibold text-[8.5px] text-zinc-700">
                        ({transfer.toBranchCode})
                      </span>
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-zinc-950 text-[8.5px] leading-tight">
                  <thead>
                    <tr className="bg-zinc-950 text-white uppercase">
                      <th className="border border-zinc-950 px-1 py-1 text-center w-5">#</th>
                      <th className="border border-zinc-950 px-1.5 py-1 text-left">Description</th>
                      <th className="border border-zinc-950 px-1 py-1 text-left">Category</th>
                      <th className="border border-zinc-950 px-1 py-1 text-left">Batch No</th>
                      <th className="border border-zinc-950 px-1 py-1 text-center">UOM</th>
                      <th className="border border-zinc-950 px-1 py-1 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeItems.map((item, idx) => {
                      const isCancelled = item.itemStatus === 'CANCELLED';
                      return (
                        <tr
                          key={item.id || idx}
                          className={isCancelled ? 'bg-rose-50 text-rose-700' : 'even:bg-zinc-50'}
                        >
                          <td className="border border-zinc-400 px-1 py-1 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td
                            className={`border border-zinc-400 px-1.5 py-1 font-bold ${
                              isCancelled ? 'line-through text-rose-700' : 'text-zinc-950'
                            }`}
                          >
                            {item.description}
                            {isCancelled && (
                              <span className="ml-1 inline-block px-1 py-0.5 rounded bg-rose-200 text-rose-900 text-[7px] font-black uppercase no-underline">
                                CANCELLED
                              </span>
                            )}
                          </td>
                          <td className="border border-zinc-400 px-1 py-1 text-zinc-700">
                            {item.category}
                          </td>
                          <td className="border border-zinc-400 px-1 py-1 font-mono text-zinc-800">
                            {item.batchNo || '—'}
                          </td>
                          <td className="border border-zinc-400 px-1 py-1 text-center font-bold uppercase">
                            {item.uom}
                          </td>
                          <td className="border border-zinc-400 px-1 py-1 text-right font-mono font-black tabular-nums">
                            {isCancelled ? '0' : Number(item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-zinc-100 font-black">
                      <td
                        colSpan={5}
                        className="border border-zinc-950 px-1.5 py-1 text-right uppercase text-[8px]"
                      >
                        Total Items ({activeItems.length}
                        {cancelledCount > 0 ? `/${safeItems.length}` : ''} Lines) · Total Qty
                      </td>
                      <td className="border border-zinc-950 px-1 py-1 text-right font-mono tabular-nums">
                        {totalQty.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {transfer.remarks && (
                  <div className="mt-1.5 border border-zinc-400 px-1.5 py-1 text-[8.5px] bg-zinc-50">
                    <span className="font-bold uppercase text-zinc-700">Remarks: </span>
                    <span className="text-zinc-900">{transfer.remarks}</span>
                  </div>
                )}
              </div>

              {/* Signatures Footer */}
              <div className="pt-3 mt-2 border-t border-dashed border-zinc-400">
                <div className="grid grid-cols-3 gap-2.5 text-[8.5px]">
                  <div>
                    <div className="text-[7.5px] font-bold uppercase tracking-wider text-zinc-600 mb-3.5">
                      Prepared By:
                    </div>
                    <div className="border-b border-zinc-950 pb-0.5 font-bold text-center text-zinc-950 uppercase min-h-[13px] truncate">
                      {transfer.preparedBy || '________________'}
                    </div>
                    <div className="text-[7px] text-center text-zinc-600 mt-0.5 uppercase">
                      Printed Name
                    </div>
                  </div>
                  <div>
                    <div className="text-[7.5px] font-bold uppercase tracking-wider text-zinc-600 mb-3.5">
                      Reviewed By:
                    </div>
                    <div className="border-b border-zinc-950 pb-0.5 font-bold text-center text-zinc-950 uppercase min-h-[13px] truncate">
                      {transfer.reviewedBy || '________________'}
                    </div>
                    <div className="text-[7px] text-center text-zinc-600 mt-0.5 uppercase">
                      Warehouse Staff
                    </div>
                  </div>
                  <div>
                    <div className="text-[7.5px] font-bold uppercase tracking-wider text-zinc-600 mb-3.5">
                      Received By:
                    </div>
                    <div className="border-b border-zinc-950 pb-0.5 font-bold text-center text-zinc-950 uppercase min-h-[13px] truncate">
                      {transfer.receivedBy || (transfer.status === 'PENDING' ? 'PENDING RECEIPT' : '________________')}
                    </div>
                    <div className="text-[7px] text-center text-zinc-600 mt-0.5 uppercase">
                      {transfer.receivedAt
                        ? formatSafeDateTime(transfer.receivedAt)
                        : 'Signature & Date'}
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-1 border-t border-zinc-300 flex items-center justify-between text-[7.5px] text-zinc-500 font-mono">
                  <span>FBC RESTAURANTS CORP. · 1/4 LETTER STR COPY</span>
                  <span>
                    {transfer.strRefNumber} · {transfer.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
