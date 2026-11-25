import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Bekräfta din e-postadress för {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bekräfta din e-post</Heading>
        <Text style={text}>
          Tack för att du skapar ett konto hos{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>!
        </Text>
        <Text style={text}>
          Bekräfta e-postadressen <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
          genom att klicka på knappen nedan.
        </Text>
        <Button style={button} href={confirmationUrl}>Bekräfta e-post</Button>
        <Text style={footer}>Om du inte har skapat ett konto kan du ignorera det här mejlet.</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
