import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Återställ ditt lösenord för {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Återställ lösenord</Heading>
        <Text style={text}>
          Vi har fått en begäran om att återställa ditt lösenord för {siteName}.
          Klicka på knappen nedan för att välja ett nytt lösenord.
        </Text>
        <Button style={button} href={confirmationUrl}>Välj nytt lösenord</Button>
        <Text style={footer}>Om du inte har begärt detta kan du ignorera mejlet. Ditt lösenord ändras inte.</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 800, color: '#303465', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55586F', lineHeight: '1.5', margin: '0 0 25px' }
const button = {
  backgroundColor: '#C21883', color: '#ffffff', fontSize: '14px', fontWeight: 600,
  border: '1px solid #C21883', borderRadius: '6px', padding: '12px 20px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#55586F', margin: '30px 0 0' }
