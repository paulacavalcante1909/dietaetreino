import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { Spinner } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { AddFoodPage } from './pages/AddFoodPage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { FoodFormPage } from './pages/FoodFormPage'
import { GoalsPage } from './pages/GoalsPage'
import { HomePage } from './pages/HomePage'
import { MealsPage } from './pages/MealsPage'
import { RecipeEditorPage } from './pages/RecipeEditorPage'
import { RecipesPage } from './pages/RecipesPage'
import { TermsPage } from './pages/MiscPages'
import { ProgressPage } from './pages/ProgressPage'
import { ErrorBoundary, InstallBanner, OfflineBanner } from './components/AppChrome'
import { SettingsPage } from './pages/SettingsPage'
import { CheckinPage } from './pages/CheckinPage'
import { CheckinsPage } from './pages/CheckinsPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { WorkoutSessionPage } from './pages/WorkoutSessionPage'
import { WorkoutsPage } from './pages/WorkoutsPage'

/** Exige login; sem meta definida, manda para o onboarding. */
function Private({ children, needsGoal = true }: { children: ReactNode; needsGoal?: boolean }) {
  const { user, goal, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/entrar" replace />
  if (needsGoal && !goal) return <Navigate to="/metas/inicio" replace />
  return children
}

function Public({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (user) return <Navigate to="/" replace />
  return children
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <OfflineBanner />
          <InstallBanner />
          <Routes>
            <Route path="/entrar" element={<Public><LoginPage /></Public>} />
            <Route path="/cadastro" element={<Public><RegisterPage /></Public>} />
            <Route path="/termos" element={<TermsPage />} />
            <Route path="/metas/inicio" element={<Private needsGoal={false}><GoalsPage onboarding /></Private>} />
            <Route path="/metas" element={<Private><GoalsPage /></Private>} />

            {/* Telas cheias (sem barra inferior) */}
            <Route path="/adicionar" element={<Private><AddFoodPage /></Private>} />
            <Route path="/alimentos/novo" element={<Private><FoodFormPage /></Private>} />
            <Route path="/alimentos/:id/editar" element={<Private><FoodFormPage /></Private>} />
            <Route path="/refeicoes" element={<Private><MealsPage /></Private>} />
            <Route path="/receitas" element={<Private><RecipesPage /></Private>} />
            <Route path="/receitas/nova" element={<Private><RecipeEditorPage /></Private>} />
            <Route path="/receitas/:id" element={<Private><RecipeEditorPage /></Private>} />
            <Route path="/treinos/:id" element={<Private><WorkoutPage /></Private>} />
            <Route path="/treinos/:id/iniciar" element={<Private><WorkoutSessionPage /></Private>} />
            <Route path="/checkin" element={<Private><CheckinPage /></Private>} />
            <Route path="/checkins" element={<Private><CheckinsPage /></Private>} />

            <Route element={<Private><Layout /></Private>}>
              <Route path="/" element={<HomePage />} />
              <Route path="/treinos" element={<WorkoutsPage />} />
              <Route path="/progresso" element={<ProgressPage />} />
              <Route path="/ajustes" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}
