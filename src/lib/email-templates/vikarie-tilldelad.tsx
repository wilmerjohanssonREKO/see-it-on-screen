import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  schoolName?: string
  substituteName?: string
  subject?: string
  date?: string
  startTime?: string
  endTime?: string
}

const Email = ({ schoolName, substituteName, subject, date, startTime, endTime }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>En vikarie har tagit ert uppdrag ({subject ?? 'vikariebehov'})</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>En vikarie har tagit ert uppdrag</Heading>
        <Text style={text}>{schoolName ? `Hej ${schoolName}!` : 'Hej!'}</Text>
        <Text style={text}>
          Ert vikariebehov har tillsatts. Vikarien ser era kontaktuppgifter i sitt schema.
        </Text>
        <Section style={box}>
          <Text style={row}><strong>Vikarie:</strong> {substituteName ?? '—'}</Text>
          <Text style={row}><strong>Ämne:</strong> {subject ?? '—'}</Text>
          <Text style={row}><strong>Datum:</strong> {date ?? '—'}</Text>
          <Text style={row}><strong>Tid:</strong> {startTime ?? '—'}–{endTime ?? '—'}</Text>
        </Section>
        <Button style={button} href="https://rekoweb.com/skola">
          Öppna er sida
        </Button>
        <Text style={footer}>REKO UF — vikarieförmedling för gymnasieskolor</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `En vikarie har tagit ert uppdrag (${d.subject ?? 'vikariebehov'})`,
  displayName: 'Vikarie tilldelad (skola)',
  previewData: {
    schoolName: 'Testgymnasiet',
    substituteName: 'Anna Andersson',
    subject: 'Matematik',
    date: '2026-10-26',
    startTime: '08:00',
    endTime: '15:00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const heading = { color: '#302D2B', fontSize: '22px' }
const text = { color: '#302D2B', fontSize: '15px', lineHeight: '22px' }
const box = {
  backgroundColor: '#F8F1E8',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '12px 0',
}
const row = { color: '#302D2B', fontSize: '15px', margin: '4px 0' }
const button = {
  backgroundColor: '#A94D3A',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 20px',
  fontSize: '15px',
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: '8px',
}
const footer = { color: '#8a8580', fontSize: '12px', marginTop: '24px' }
