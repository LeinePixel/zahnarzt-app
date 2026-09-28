import { getImageProps } from 'next/image'

export function BrandLogo({ className }: { className: string }) {
  const { props } = getImageProps({
    src: '/dentpilot-logo-negativ.png',
    alt: 'DentPilot',
    width: 1180,
    height: 336,
    priority: true,
    className,
  })

  // Next's generated transparent inline style is unnecessary for this logo.
  // Omitting it keeps the strict style-src policy while retaining image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt} style={undefined} />
}
