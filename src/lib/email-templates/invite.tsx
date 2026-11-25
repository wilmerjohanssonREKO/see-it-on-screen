import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Du har blivit inbjuden till {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Du har fått en inbjudan</Heading>
        <Text style={text}>
          Du har blivit inbjuden till <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
          Klicka på knappen nedan för att acceptera inbjudan och skapa ditt konto.
        </Text>
        <Button style={button} href={confirmationUrl}>Acceptera inbjudan</Button>
        <Text style={footer}>Om du inte väntade dig den här inbjudan kan du ignorera mejlet.</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 800, color: '#303465', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55586F', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: '#303465', textDecoration: 'underline' }
const button = {
  backgroundColor: '#C21883', color: '#ffffff', fontSize: '14px', fontWeight: 600,
  border: '1px solid #C21883', borderRadius: '6px', padding: '12px 20px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#55586F', margin: '30px 0 0' }
