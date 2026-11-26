<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Weight;
use App\Services\EnergyEstimator;
use App\Services\ImageStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuthController extends Controller
{
    /** Regras dos dados do corpo usados no gasto estimado (todos opcionais). */
    private const BODY_RULES = [
        'sex' => ['sometimes', 'nullable', 'in:f,m'],
        'birth_date' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'before:-10 years', 'after:1900-01-01'],
        'height_cm' => ['sometimes', 'nullable', 'integer', 'min:100', 'max:250'],
    ];

    private const BODY_MESSAGES = [
        'birth_date.before' => 'Confira a data de nascimento.',
        'birth_date.after' => 'Confira a data de nascimento.',
        'height_cm.min' => 'Informe a altura em centímetros (ex.: 165).',
        'height_cm.max' => 'Informe a altura em centímetros (ex.: 165).',
    ];

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', Password::min(8)],
            'terms' => ['accepted'],
        ], [
            'email.unique' => 'Já existe uma conta com este e-mail.',
            'terms.accepted' => 'É preciso aceitar os Termos de Uso e a Política de Privacidade.',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'password' => $data['password'],
            'terms_accepted_at' => now(),
        ]);

        return response()->json($this->sessionPayload($user), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower($data['email']))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'E-mail ou senha incorretos.',
            ]);
        }

        return response()->json($this->sessionPayload($user));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => $user,
            'goal' => $user->goalFor(now()->toDateString()),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email,'.$user->id],
            ...self::BODY_RULES,
        ], ['email.unique' => 'Já existe uma conta com este e-mail.', ...self::BODY_MESSAGES]);

        $user->update([...$data, 'email' => strtolower($data['email'])]);

        return response()->json(['user' => $user]);
    }

    /**
     * Dados do corpo (passo "Sobre você"): sexo, nascimento, altura e, opcionalmente, o peso de hoje.
     * Devolve o gasto estimado já recalculado.
     */
    public function updateBody(Request $request, EnergyEstimator $energy): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            ...self::BODY_RULES,
            'weight_kg' => ['sometimes', 'nullable', 'numeric', 'min:20', 'max:400'],
        ], [
            ...self::BODY_MESSAGES,
            'weight_kg.min' => 'Confira o peso informado.',
            'weight_kg.max' => 'Confira o peso informado.',
        ]);

        $user->update(collect($data)->except('weight_kg')->all());
        if (! empty($data['weight_kg'])) {
            Weight::updateOrCreate(['user_id' => $user->id, 'date' => now()->toDateString()], ['kg' => $data['weight_kg']]);
        }

        return response()->json(['user' => $user->fresh(), 'energy' => $energy->forDate($user, now()->toDateString())]);
    }

    /** Gasto estimado de hoje (para sugerir metas). */
    public function energy(Request $request, EnergyEstimator $energy): JsonResponse
    {
        return response()->json(['energy' => $energy->forDate($request->user(), now()->toDateString())]);
    }

    /** Preferências do app (ex.: somar calorias do treino à meta do dia). */
    public function updatePreferences(Request $request): JsonResponse
    {
        $data = $request->validate([
            'add_burned_to_goal' => ['sometimes', 'boolean'],
            'weekly_workout_goal' => ['sometimes', 'integer', 'min:1', 'max:7'],
        ]);
        $request->user()->update($data);

        return response()->json(['user' => $request->user()->fresh()]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'string', Password::min(8), 'different:current_password'],
        ], [
            'current_password.current_password' => 'Senha atual incorreta.',
            'password.different' => 'A nova senha deve ser diferente da atual.',
        ]);

        $request->user()->update(['password' => $data['password']]);

        return response()->json(['ok' => true]);
    }

    /** Foto de perfil: recorte quadrado de 512 px, sem metadados. */
    public function updateAvatar(Request $request, ImageStore $images): JsonResponse
    {
        $request->validate(
            ['avatar' => ['required', 'image', 'mimes:jpeg,png,webp,heic,heif', 'max:12288']],
            ['avatar.image' => 'O arquivo precisa ser uma imagem.', 'avatar.max' => 'A foto é muito grande (máximo 12 MB).'],
        );
        $user = $request->user();
        $path = $images->store($request->file('avatar'), "avatars/{$user->id}", 512, square: true, field: 'avatar');
        if ($user->avatar_path) {
            Storage::disk('local')->delete($user->avatar_path);
        }
        $user->update(['avatar_path' => $path]);

        return response()->json(['user' => $user]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->avatar_path) {
            Storage::disk('local')->delete($user->avatar_path);
            $user->update(['avatar_path' => null]);
        }

        return response()->json(['user' => $user]);
    }

    /** Entrega a foto de perfil via link assinado. */
    public function avatar(User $user): StreamedResponse
    {
        abort_unless($user->avatar_path, 404);

        return Storage::disk('local')->response($user->avatar_path, null, ['Cache-Control' => 'private, max-age=21600']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'current_password:sanctum'],
        ], ['password.current_password' => 'Senha incorreta.']);

        $user = $request->user();
        $user->tokens()->delete();
        Storage::disk('local')->deleteDirectory("checkins/{$user->id}"); // fotos dos treinos
        Storage::disk('local')->deleteDirectory("avatars/{$user->id}"); // foto de perfil
        $user->delete(); // dados relacionados caem por cascade

        return response()->json(['ok' => true]);
    }

    private function sessionPayload(User $user): array
    {
        return [
            'token' => $user->createToken('pwa')->plainTextToken,
            'user' => $user,
            'goal' => $user->goalFor(now()->toDateString()),
        ];
    }
}
