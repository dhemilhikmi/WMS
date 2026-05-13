/**
 * Seed script: buat InventoryBatch pertama dari stok existing setiap inventory item.
 * Jalankan SEKALI setelah migration add_inventory_batch_and_conversion.
 *
 * Usage: npx ts-node prisma/seed-inventory-batches.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const items = await prisma.inventory.findMany({
    where: { stok: { gt: 0 } },
    include: { batches: { take: 1 } },
  })

  let created = 0
  let skipped = 0

  for (const item of items) {
    // Skip jika sudah punya batch (idempotent)
    if (item.batches.length > 0) {
      skipped++
      continue
    }

    // Hitung harga per satuan pakai
    // Jika ada konversi (isiPerUnit), hargaPerUnit = hargaSatuan / isiPerUnit
    // Jika tidak ada konversi, hargaPerUnit = hargaSatuan (1:1)
    const isiPerUnit = item.isiPerUnit ?? 1
    const hargaSatuan = Number(item.hargaSatuan) || 0
    const hargaPerUnit = isiPerUnit > 0 ? hargaSatuan / isiPerUnit : hargaSatuan

    // stok sudah dalam satuan pakai (atau satuan beli jika tidak ada konversi)
    const qtySisa = item.stok

    await prisma.inventoryBatch.create({
      data: {
        inventoryId: item.id,
        tenantId: item.tenantId,
        qtyAwal: qtySisa,
        qtySisa,
        hargaPerUnit,
        noPO: null,
        pemasok: item.pemasok || null,
        isStokAwal: true,
        tanggal: item.createdAt, // pakai tanggal item dibuat sebagai tanggal batch
      },
    })

    created++
    console.log(`✅ Batch stok awal: ${item.nama} | qty: ${qtySisa} ${item.satuanPakai || item.satuan} | harga/unit: Rp ${Math.round(hargaPerUnit).toLocaleString('id-ID')}`)
  }

  console.log(`\nSelesai: ${created} batch dibuat, ${skipped} item dilewati (sudah punya batch)`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
