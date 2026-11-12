import React from 'react';
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';

const Email = ({ schoolName, subject, date, startTime, endTime }: Record<string, string>) => (
  <Html lang="sv"><Head /><Preview>Bokningen har avbokats</Preview>
    <Body style={{ backgroundColor: '#F5F3F7', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ backgroundColor: '#fff', padding: '24px', color: '#303465' }}>
        <Heading>Bokningen har avbokats</Heading>
        <Text>REKO har avslutat den tidigare bokningen för {subject ?? 'uppdraget'} hos {schoolName ?? 'skolan'}.</Text>
        <Text>{date} · {startTime}–{endTime}</Text>
        <Text>Den tidigare tilldelningen gäller inte längre. Se aktuell status när du loggar in på REKO. Kontakta REKO om du har frågor.</Text>
      </Container>
    </Body>
  </Html>
);
export const template = {
  component: Email,
  subject: 'Bokningen har avbokats — REKO UF',
  displayName: 'Avbokad bokning',
  previewData: { schoolName: 'Testgymnasiet', subject: 'Matematik', date: '2026-12-01', startTime: '08:00', endTime: '12:00' },
} satisfies TemplateEntry;
