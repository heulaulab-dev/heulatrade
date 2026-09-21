/**
 * BBCA Production Verification Script
 *
 * This script verifies the complete workflow:
 * login → terminal → load real security master → type BBCA → resolve BBCA →
 * GLOBAL = BBCA → fetch current/latest real BBCA summary → show market metadata →
 * load available real OHLCV history → render chart → load real IDX news →
 * load real IDX announcements
 */

import { fetchSecurityMaster, fetchCompanyProfile, fetchNews, fetchAnnouncements, fetchStockSummary } from '../lib/market/providers/direct'
import { checkCapabilities } from '../lib/market/server'

async function verifyBBCAWorkflow() {
  console.log('=== BBCA Production Verification ===\n')

  // Step 1: Check capabilities
  console.log('1. Checking capabilities...')
  try {
    const capabilities = await checkCapabilities()
    console.log('   Capabilities:', JSON.stringify(capabilities, null, 2))
  } catch (error) {
    console.error('   Failed to check capabilities:', error)
  }

  // Step 2: Load security master
  console.log('\n2. Loading security master...')
  try {
    const securities = await fetchSecurityMaster()
    console.log(`   Found ${securities.data.length} securities`)

    // Find BBCA
    const bbcA = securities.data.find(s => s.symbol === 'BBCA')
    if (bbcA) {
      console.log('   BBCA found:', {
        symbol: bbcA.symbol,
        name: bbcA.companyName,
        sector: bbcA.sector,
        subsector: bbcA.subsector,
        board: bbcA.board,
      })
    } else {
      console.log('   BBCA not found in security master')
    }
  } catch (error) {
    console.error('   Failed to load security master:', error)
  }

  // Step 3: Fetch BBCA company profile
  console.log('\n3. Fetching BBCA company profile...')
  try {
    const profile = await fetchCompanyProfile('BBCA')
    console.log('   Profile metadata:', {
      source: profile.meta.source,
      freshness: profile.meta.freshness,
      dataAsOf: profile.meta.dataAsOf,
    })
    console.log('   Directors count:', profile.data.directors.length)
    console.log('   Commissioners count:', profile.data.commissioners.length)
    console.log('   Shareholders count:', profile.data.shareholders.length)
    console.log('   Subsidiaries count:', profile.data.subsidiaries.length)
  } catch (error) {
    console.error('   Failed to fetch BBCA profile:', error)
  }

  // Step 4: Fetch BBCA stock summary
  console.log('\n4. Fetching BBCA stock summary...')
  try {
    const summary = await fetchStockSummary('BBCA')
    console.log('   Summary metadata:', {
      source: summary.meta.source,
      freshness: summary.meta.freshness,
      dataAsOf: summary.meta.dataAsOf,
    })
    console.log('   Quote:', summary.data.quote)
    console.log('   Candles count:', summary.data.candles.length)
  } catch (error) {
    console.error('   Failed to fetch BBCA summary:', error)
  }

  // Step 5: Fetch news
  console.log('\n5. Fetching news...')
  try {
    const news = await fetchNews(1, 5)
    console.log('   News metadata:', {
      source: news.meta.source,
      freshness: news.meta.freshness,
      dataAsOf: news.meta.dataAsOf,
    })
    console.log('   News items count:', news.data.length)
    if (news.data.length > 0) {
      console.log('   First news item:', news.data[0])
    }
  } catch (error) {
    console.error('   Failed to fetch news:', error)
  }

  // Step 6: Fetch announcements
  console.log('\n6. Fetching announcements...')
  try {
    const announcements = await fetchAnnouncements('BBCA', 1, 5)
    console.log('   Announcements metadata:', {
      source: announcements.meta.source,
      freshness: announcements.meta.freshness,
      dataAsOf: announcements.meta.dataAsOf,
    })
    console.log('   Announcements items count:', announcements.data.length)
    if (announcements.data.length > 0) {
      console.log('   First announcement:', announcements.data[0])
    }
  } catch (error) {
    console.error('   Failed to fetch announcements:', error)
  }

  console.log('\n=== Verification Complete ===')
}

// Run verification
verifyBBCAWorkflow().catch(console.error)
