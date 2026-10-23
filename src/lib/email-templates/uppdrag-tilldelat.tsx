import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  schoolName?: string
  subject?: string
  date?: string
  startTime?: string
  endTime?: string
}

const Email = ({ name, schoolName, subject, date, startTime, endTime }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Du har fått uppdraget hos {schoolName ?? 'skolan'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Du har fått uppdraget!</Heading>
        <Text style={text}>{name ? `Hej ${name}!` : 'Hej!'}</Text>
        <Text style={text}>
          Du har tilldelats ett vikarieuppdrag. Här är detaljerna:
        </Text>
        <Section style={box}>
          <Text style={row}><strong>Skola:</strong> {schoolName ?? '—'}</Text>
          <Text style={row}><strong>Ämne:</strong> {subject ?? '—'}</Text>
          <Text style={row}><strong>Datum:</strong> {date ?? '—'}</Text>
          <Text style={row}><strong>Tid:</strong> {startTime ?? '—'}–{endTime ?? '—'}</Text>
        </Section>
        <Text style={text}>
          Skolans kontaktuppgifter hittar du på ditt schema i REKO UF.
        </Text>
        <Button style={button} href="https://rekoweb.com/uppdrag">
          Öppna mitt schema
        </Button>
        <Text style={footer}>REKO UF — vikarieförmedling för gymnasieskolor</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Du har fått uppdraget hos ${d.schoolName ?? 'skolan'}`,
  displayName: 'Uppdrag tilldelat (vikarie)',
  previewData: {
    name: 'Anna',
    schoolName: 'Testgymnasiet',
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
