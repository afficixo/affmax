export type SignupField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'address'
  | 'city'
  | 'state'
  | 'zipcode'
  | 'country'
  | 'password'
  | 'confirmPassword'
  | 'verticals'
  | 'traffic'
  | 'terms'

export type SignupFieldErrors = Partial<Record<SignupField, string>>

export type SignupValidationInput = {
  firstName: string
  lastName: string
  email: string
  address: string
  city: string
  state: string
  zipcode: string
  country: string
  password: string
  confirmPassword: string
  verticals: string
  traffic: string
  agreed: boolean
  skype?: string
  hearAbout?: string
  referralCode?: string
}

export function validateSignupFields(values: SignupValidationInput): SignupFieldErrors {
  const errors: SignupFieldErrors = {}
  const requiredFields: Array<[Exclude<SignupField, 'email' | 'terms' | 'confirmPassword'>, string, string]> = [
    ['firstName', values.firstName, 'First name'],
    ['lastName', values.lastName, 'Last name'],
    ['address', values.address, 'Address'],
    ['city', values.city, 'City'],
    ['state', values.state, 'State'],
    ['zipcode', values.zipcode, 'ZIP code'],
    ['country', values.country, 'Country'],
    ['password', values.password, 'Password'],
    ['verticals', values.verticals, 'Traffic verticals'],
    ['traffic', values.traffic, 'Traffic source'],
  ]

  for (const [field, value, label] of requiredFields) {
    if (!value.trim()) errors[field] = `${label} is required.`
  }

  const email = values.email.trim()
  if (!email) {
    errors.email = 'E-mail is required.'
  } else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'Enter a valid e-mail address.'
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = 'Confirm password is required.'
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  if (!values.agreed) {
    errors.terms = 'Please accept the Terms and Conditions and Privacy Policy.'
  }

  return errors
}
