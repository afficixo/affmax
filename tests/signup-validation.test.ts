import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateSignupFields, type SignupValidationInput } from '../src/lib/signup-validation'

const validSignup: SignupValidationInput = {
  firstName: 'Alex',
  lastName: 'Example',
  email: 'alex@example.com',
  address: '1 Main Street',
  city: 'London',
  state: 'London',
  zipcode: 'SW1A 1AA',
  country: 'GB',
  password: 'strong-password',
  confirmPassword: 'strong-password',
  verticals: 'Technology',
  traffic: 'Content sites',
  agreed: true,
}

test('requires all mandatory signup fields but ignores optional fields', () => {
  const errors = validateSignupFields({
    ...validSignup,
    firstName: '',
    email: '',
    skype: '',
    hearAbout: '',
    referralCode: '',
  })

  assert.deepEqual(errors, {
    firstName: 'First name is required.',
    email: 'E-mail is required.',
  })
})

test('rejects malformed or overlong email addresses', () => {
  assert.equal(
    validateSignupFields({ ...validSignup, email: 'not-an-email' }).email,
    'Enter a valid e-mail address.',
  )
  assert.equal(
    validateSignupFields({ ...validSignup, email: `${'a'.repeat(250)}@example.com` }).email,
    'Enter a valid e-mail address.',
  )
})

test('requires matching passwords and terms acceptance', () => {
  const errors = validateSignupFields({
    ...validSignup,
    confirmPassword: 'different-password',
    agreed: false,
  })

  assert.equal(errors.confirmPassword, 'Passwords do not match.')
  assert.equal(errors.terms, 'Please accept the Terms and Conditions and Privacy Policy.')
})
