import ResetPasswordForm from './components/ResetPasswordForm'

export default function ResetPasswordPage() {
  function handleSuccess() {
    window.location.href = '/'
  }

  return <ResetPasswordForm onSuccess={handleSuccess} />
}
